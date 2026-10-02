/** The real fixture page. Requests go through the Go gateway, not a UI mock. */
const list = document.querySelector('#members');
const status = document.querySelector('#status');
const form = document.querySelector('form');
function tellParent(type, payload) {
  window.parent.postMessage({type, payload}, window.location.origin);
}
async function loadMembers() {
  const response = await fetch('/demo-api/members');
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '无法加载成员');
  renderMembers(result.data);
  tellParent('atlas-run', result.run);
}
function renderMembers(members) {
  list.replaceChildren();
  for (const member of members) {
    const row = document.createElement('button');
    row.className = 'member'; row.type = 'button';
    const avatar = document.createElement('span'); avatar.className = 'avatar'; avatar.textContent = member.name.slice(0, 1);
    const name = document.createElement('span'); name.textContent = member.name;
    const email = document.createElement('small'); email.textContent = member.email;
    const team = document.createElement('em'); team.textContent = member.team || '产品研发';
    name.append(email); row.append(avatar, name, team);
    row.addEventListener('click', () => {
      const rect = row.getBoundingClientRect(), style = getComputedStyle(row);
      tellParent('atlas-inspect', {symbol: 'renderMembers', row: member, layout: {display: style.display, position: style.position, gap: style.gap, padding: style.padding, width: Math.round(rect.width), height: Math.round(rect.height), parent: '#members'}});
    });
    list.append(row);
  }
}
async function createMember(event) {
  event.preventDefault();
  const button = form.querySelector('button'); button.disabled = true; status.textContent = '正在提交…';
  try {
    const data = Object.fromEntries(new FormData(form));
    const response = await fetch('/demo-api/members', {method: 'POST', headers: {'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID()}, body: JSON.stringify(data)});
    const result = await response.json();
    tellParent('atlas-run', result.run);
    if (!response.ok) throw new Error(result.error || '提交失败');
    const createdRun = result.run;
    await loadMembers();
    tellParent('atlas-run', createdRun);
    form.reset(); status.textContent = '已创建。可以在右侧查看提交记录。';
  } catch (error) { status.textContent = error.message; }
  finally { button.disabled = false; }
}
form.addEventListener('submit', createMember);
loadMembers().catch(error => {status.textContent = error.message;});
