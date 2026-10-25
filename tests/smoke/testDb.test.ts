import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertTestDatabaseUrl, databaseNameFromUrl, deriveTestDatabaseUrl } from './testDb';

describe('testDb guard', () => {
  it('extracts the database name, ignoring query params', () => {
    assert.equal(databaseNameFromUrl('mysql://u:p@localhost:3306/smash'), 'smash');
    assert.equal(databaseNameFromUrl('mysql://u:p@localhost:3306/smash?connection_limit=5'), 'smash');
  });

  it('derives the test URL by changing only the database name', () => {
    assert.equal(
      deriveTestDatabaseUrl('mysql://u:p%40x@db.local:3307/smash'),
      'mysql://u:p%40x@db.local:3307/smash_test',
    );
    assert.equal(
      deriveTestDatabaseUrl('mysql://u:p@localhost:3306/smash?x=1'),
      'mysql://u:p@localhost:3306/smash_test?x=1',
    );
  });

  it('does not double the suffix when already a test database', () => {
    assert.equal(
      deriveTestDatabaseUrl('mysql://u:p@localhost:3306/smash_test'),
      'mysql://u:p@localhost:3306/smash_test',
    );
  });

  it('accepts URLs whose database name ends with _test', () => {
    assert.doesNotThrow(() => assertTestDatabaseUrl('mysql://u:p@localhost:3306/smash_test'));
  });

  it('refuses the dev database and other names', () => {
    for (const url of [
      'mysql://u:p@localhost:3306/smash',
      'mysql://u:p@localhost:3306/smash_test_backup',
      'mysql://u:p@localhost:3306/test',
      'mysql://u:p@localhost:3306/',
    ]) {
      assert.throws(() => assertTestDatabaseUrl(url), /_test/, url);
    }
  });

  it('refuses missing or malformed URLs without leaking them', () => {
    assert.throws(() => assertTestDatabaseUrl(undefined), /_test/);
    assert.throws(() => assertTestDatabaseUrl('not a url secret'), (e: Error) => !e.message.includes('secret'));
  });
});
