"""Explicit demo architecture overlays compiler facts; grouping is never claimed inferred."""
from pathlib import Path
from .analysis import ROOT, analyze_files


def build_demo():
    paths=['demo/api/main.go','demo/storage/service.py','demo/storage/schema.sql','demo/web/portal.js']
    files={p:(ROOT/p).read_text() for p in paths}
    graph=analyze_files(files)
    groups=[
        ('browser','Members Web','process','JavaScript',None,'真实成员页面；查看、创建成员，点击行可检查布局与来源。'),
        ('api','Member API','process','Go',None,'HTTP 入口与 StorageClient；只读请求失败后允许一次重试。'),
        ('storage','Member Service','process','Python',None,'校验业务数据、管理事务与幂等键，提供 SQLite 持久化。'),
        ('database','SQLite','database','SQL',None,'真实 SQLite 文件；含 members、teams 与幂等操作记录。'),
        ('api.entry','接口 / 入口层','layer','Go','api','HTTP 路由、请求大小限制与响应序列化。'),
        ('api.client','连接 / Client 层','layer','Go','api','将请求通过 HTTP 发送到 Python 服务；传播关联标识。'),
        ('api.types','类型与基础实现','layer','Go','api','按需查看事件类型与网关结构；默认不展开。'),
        ('storage.domain','应用 / 事务层','layer','Python','storage','成员读取、校验、创建、幂等与事务提交。'),
        ('storage.bootstrap','入口 / 组装层','layer','Python','storage','初始化存储、注册 HTTP 处理器与监听。'),
    ]
    top=[]
    for id,label,kind,language,parent,summary in groups:
        top.append(dict(id=id,label=label,kind=kind,language=language,parent=parent,summary=summary,evidence='declared'))
    symbols=[n for n in graph['nodes'] if n['kind'] not in ('file','library')]
    for n in symbols:
        p=n['source']['path'];label=n['label']
        n['parent']='browser' if '/web/' in p else ('api.client' if label=='Gateway.callStorage' else 'api.entry' if label in ('main','Gateway.serveMembers') else 'api.types') if '/api/' in p else 'storage.domain' if label.startswith('MemberStore.') or label=='Member' else 'storage.bootstrap'
    for table,summary in [('members','成员记录：主键、唯一邮箱、部门外键。'),('teams','部门字典；由 members.team_id 引用。')]:
        top.append(dict(id='table:'+table,label=table,kind='table',language='SQL',parent='database',summary=summary,evidence='extracted',source={'path':'demo/storage/schema.sql','line':2 if table=='teams' else 6}))
    libraries=[n for n in graph['nodes'] if n['kind']=='library']
    for n in libraries:n['parent']='api.types' if n['language']=='Go' else 'storage.bootstrap'
    graph['nodes']=top+symbols+libraries
    ids={n['id'] for n in graph['nodes']}
    graph['edges']=[e for e in graph['edges'] if e['source'] in ids and e['target'] in ids]
    for a,b,label,relation in [('browser','api','HTTP /members','http'),('api','storage','StorageClient · HTTP','http'),('storage','database','SQL · SQLite','database'),('api.entry','api.client','调用 Client','calls'),('api.client','storage','GET / POST','http'),('storage.bootstrap','storage.domain','装配','binds'),('storage.domain','database','事务 / 查询','database'),('table:members','table:teams','team_id → id','foreign_key')]:
        graph['edges'].append(dict(source=a,target=b,label=label,relation=relation,evidence='declared'))
    def src(path, needle):
        return {'path':path,'line':next((i for i,l in enumerate(files[path].splitlines(),1) if needle in l),1)}
    specs=[
        ('timeout','下游请求超时','1500 ms','api','const clientTimeout','demo/api/main.go','每次 HTTP 尝试使用独立的 1.5 秒 client timeout；不是整条业务的总 deadline。'),
        ('retry','只读重试','最多 2 次尝试','api','const maxAttempts','demo/api/main.go','仅 GET；网络或 5xx 失败后等待 120 ms 再试。首次包含在次数内；没有 jitter。'),
        ('id','成员 ID','UUID v4','storage','member_id = str(uuid.uuid4())','demo/storage/service.py','成员实体标识由 Python uuid.uuid4 生成；不作为认证秘密。'),
        ('idempotency','重复写入保护','同事务存储','storage',"SELECT fingerprint,member_id",'demo/storage/service.py','相同 key 与资料返回原结果；同 key 不同资料拒绝。没有设置过期清理。'),
        ('transaction','SQLite 事务','BEGIN IMMEDIATE','storage',"BEGIN IMMEDIATE",'demo/storage/service.py','成员和幂等记录一起提交；字段唯一与外键约束由数据库执行。'),
    ]
    graph['policies']=[dict(id=id,label=label,value=value,owner=owner,summary=summary,source=src(path,needle),evidence='declared',rationale='示例机制说明；尚未实现任意仓库的通用机制识别。') for id,label,value,owner,needle,path,summary in specs]
    graph.update(name='Members / 全栈示例',mode='demo',capabilities={'runtime':True,'rows':True},notice='分组与跨进程绑定为显式示例模型；函数来自真实 AST。运行步骤由示例代码显式记录，不是通用自动插桩。')
    return graph
