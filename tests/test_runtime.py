"""Real-process integration tests. No mocked HTTP client or database."""
from pathlib import Path
import shutil
import tempfile
import unittest
import uuid
from observatory.server import Runtime
from observatory.analysis import analyze_files


@unittest.skipUnless(shutil.which('go'), 'Go is required for the real gateway fixture')
class RuntimeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.runtime = Runtime(Path(cls.temp.name))
        if cls.runtime.error:
            raise RuntimeError(cls.runtime.error)

    @classmethod
    def tearDownClass(cls):
        cls.runtime.close()
        cls.temp.cleanup()

    def test_get_reaches_real_database_with_one_correlation_id(self):
        run = self.runtime.execute()
        self.assertEqual(run['status'], 200)
        self.assertEqual({e['service'] for e in run['events']}, {'api', 'storage'})
        self.assertTrue(all(e['trace_id'] == run['id'] for e in run['events']))
        query = next(e for e in run['events'] if e['kind'] == 'query')
        self.assertEqual(query['rows'], run['response']['data'])

    def test_failure_really_triggers_one_retry(self):
        run = self.runtime.execute(scenario='fail_once')
        attempts = [e for e in run['events'] if e['kind'] == 'client']
        self.assertEqual([e['state']['status'] for e in attempts], [503, 200])
        self.assertEqual([e['state']['attempt'] for e in attempts], [1, 2])
        self.assertTrue(any(e['state'].get('backoff_ms') == 120 for e in run['events']))
        self.assertGreaterEqual(run['duration_ms'], 110)

    def test_post_idempotency_through_both_services(self):
        key = uuid.uuid4().hex
        body = {'name': 'Integration test', 'email': f'{key}@example.test'}
        first = self.runtime.execute('POST', body, key=key)
        second = self.runtime.execute('POST', body, key=key)
        self.assertEqual(first['status'], 201)
        self.assertEqual(second['status'], 200)
        self.assertEqual(first['response']['data']['id'], second['response']['data']['id'])
        self.assertEqual(len([e for e in second['events'] if e['kind']=='client']), 1)

    def test_validation_error_does_not_trigger_post_retry(self):
        run = self.runtime.execute('POST', {'name': '', 'email': 'bad'}, scenario='fail_once')
        self.assertEqual(run['status'], 400)
        self.assertEqual(len([e for e in run['events'] if e['kind']=='client']), 1)

    def test_startup_has_distinct_processes(self):
        self.assertEqual({e['service'] for e in self.runtime.startup}, {'api', 'storage'})
        self.assertEqual(len({e['pid'] for e in self.runtime.startup}), 2)

    def test_read_replay_is_immutable(self):
        run = self.runtime.execute()
        before = list(run['events'])
        stored = self.runtime.runs[0]
        self.assertEqual(stored['events'], before)
        # Re-reading stored data must not execute another request.
        self.assertEqual(len([r for r in self.runtime.runs if r['id']==run['id']]), 1)

    def test_target_method_and_scenario_allowlist(self):
        for method, scenario in [('DELETE','normal'), ('GET','external-url')]:
            with self.assertRaises(ValueError): self.runtime.execute(method, scenario=scenario)

    def test_go_parser_does_not_require_target_to_build(self):
        g = analyze_files({'main.go': 'package main\nimport "missing.example/pkg"\nfunc main(){ helper() }\nfunc helper() {}'})
        self.assertTrue(any(n['label']=='helper' for n in g['nodes']))
        self.assertTrue(any(n['label']=='missing.example/pkg' for n in g['nodes']))


if __name__ == '__main__': unittest.main()
