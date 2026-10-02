"""Acceptance-oriented tests: evidence, source safety and real data behavior."""
import tempfile
import unittest
from pathlib import Path

from observatory.analysis import analyze_files, import_graph
from demo.storage.service import MemberStore


class SourceTests(unittest.TestCase):
    def test_python_call_and_source_are_extracted(self):
        graph = analyze_files({'app.py': 'def helper():\n    return 1\n\ndef main():\n    return helper()\n'})
        names = {n['label']: n for n in graph['nodes']}
        self.assertIn('main', names)
        self.assertEqual(names['main']['source']['line'], 4)
        self.assertTrue(any(e['source'] == names['main']['id'] and e['target'] == names['helper']['id'] for e in graph['edges']))
        self.assertTrue(all(e['evidence'] != 'observed' for e in graph['edges']))

    def test_ambiguous_python_method_not_bound_by_name(self):
        graph = analyze_files({'app.py': 'def save():\n    pass\n\ndef main(obj):\n    obj.save()\n'})
        self.assertFalse(any(e['relation'] == 'calls' for e in graph['edges']))
        self.assertTrue(graph['diagnostics'])

    def test_uploaded_source_is_never_executed(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / 'should-not-exist'
            analyze_files({'evil.py': f'open({str(p)!r}, "w").write("bad")\n'})
            self.assertFalse(p.exists())

    def test_invalid_path_is_rejected(self):
        for path in ['../secret.py', '/etc/passwd', 'C:/secret.py', 'a/../../secret.py']:
            with self.assertRaises(ValueError):
                analyze_files({path: 'pass'})

    def test_invalid_graph_edges_and_duplicates_are_rejected(self):
        with self.assertRaises(ValueError):
            import_graph({'nodes': [{'id': 'a'}, {'id': 'a'}], 'edges': []})
        with self.assertRaises(ValueError):
            import_graph({'nodes': [{'id': 'a'}], 'edges': [{'source': 'a', 'target': 'b'}]})

    def test_graphify_import_keeps_direction_relation_and_confidence(self):
        graph = import_graph({'nodes': [{'id': 'a', 'label': 'main'}, {'id': 'b', 'label': 'save'}], 'edges': [{'source': 'a', 'target': 'b', 'relation': 'calls', 'confidence': 'INFERRED'}]})
        edge = graph['edges'][0]
        self.assertEqual((edge['source'], edge['target'], edge['relation'], edge['evidence']), ('a', 'b', 'calls', 'inferred'))
        self.assertEqual(graph['mode'], 'imported')


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = MemberStore(Path(self.temp.name) / 'demo.sqlite')

    def tearDown(self):
        self.temp.cleanup()

    def test_seed_and_row_lineage(self):
        result = self.store.list_members('T1')
        self.assertEqual(len(result['data']), 4)
        event = next(e for e in result['events'] if e['kind'] == 'query')
        self.assertEqual(event['rows'], result['data'])
        self.assertEqual(event['evidence'], 'observed')
        self.assertIn('members', event['sql'])

    def test_create_commits_and_idempotent_replay_does_not_duplicate(self):
        data = {'name': '测试成员', 'email': 'new@example.test', 'team_id': 't-product'}
        first = self.store.create_member(data, 'same-key', 'T1')
        second = self.store.create_member(data, 'same-key', 'T2')
        self.assertEqual(first['data']['id'], second['data']['id'])
        self.assertTrue(second['replayed'])
        self.assertEqual(len(self.store.list_members('T3')['data']), 5)
        self.assertEqual(first['events'][-1]['state']['transaction'], 'committed')

    def test_key_conflict_rejected(self):
        self.store.create_member({'name': 'A', 'email': 'a@example.test'}, 'K', 'T1')
        with self.assertRaises(ValueError):
            self.store.create_member({'name': 'B', 'email': 'b@example.test'}, 'K', 'T2')

    def test_invalid_write_does_not_change_database(self):
        for data in [{'name': '', 'email': 'x@example.test'}, {'name': 'X', 'email': 'bad'}, {'name': 'X', 'email': 'x@example.test', 'team_id': 'missing'}]:
            with self.assertRaises(ValueError):
                self.store.create_member(data, '', 'T1')
        self.assertEqual(len(self.store.list_members('T2')['data']), 4)

    def test_old_result_is_snapshot_not_live_rows(self):
        first = self.store.list_members('old')
        self.store.create_member({'name': 'N', 'email': 'n@example.test'}, '', 'new')
        self.assertEqual(len(first['events'][-1]['rows']), 4)
        self.assertEqual(len(self.store.list_members('latest')['data']), 5)


if __name__ == '__main__':
    unittest.main()

class ImportBoundaries(unittest.TestCase):
    def test_cycles_rejected(self):
        with self.assertRaises(ValueError):
            import_graph({'nodes':[{'id':'a','parent':'b'},{'id':'b','parent':'a'}], 'edges':[]})

    def test_incomplete_parent_becomes_visible_root(self):
        graph=import_graph({'nodes':[{'id':'a','parent':'not-in-export'}], 'edges':[]})
        self.assertIsNone(graph['nodes'][0]['parent'])

    def test_source_text_can_contain_html_without_execution(self):
        graph=analyze_files({'app.py':'def show():\n    return "<script>alert(1)</script>"\n'})
        self.assertIn('<script>',graph['sources']['app.py'])
        self.assertEqual(graph['nodes'][-1]['label'],'show')

    def test_json_arrays_are_not_graphs(self):
        with self.assertRaises(ValueError):import_graph([])

    def test_typescript_cross_file_signature_resolution(self):
        import os, subprocess
        try:
            subprocess.run(['node','-e',"require('typescript')"],check=True,capture_output=True)
        except (OSError,subprocess.CalledProcessError):
            self.skipTest('Install TypeScript 5.8.3 to exercise this adapter')
        graph=analyze_files({'lib.ts':'export function helper(){return 1}', 'app.ts':"import {helper} from './lib'; export function main(){ return helper() }"})
        self.assertTrue(any(e['source']=='app.ts::main' and e['target']=='lib.ts::helper' for e in graph['edges']))
