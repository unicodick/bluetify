import assert from 'node:assert/strict';
import test from 'node:test';
import { Config } from '../src/config/index.js';
import { BlueskyService } from '../src/integrations/bluesky/index.js';

const accountDid = 'did:plc:ewvi7nxzyoun6zhxrhs64oiz';
const profileCid = 'bafkreiazadvlnqbija6xcjszt3tpkdpa2j4qpnogl6uqkjcybnfq7gcswa';

const config: Config = {
  bluesky: {
    username: 'alice.test',
    password: 'app-password',
    serviceUrl: 'https://entry.test',
  },
  lastfm: { apiKey: 'key', username: 'alice' },
  stateFile: '.state.json',
  updateIntervalMs: 30_000,
};

test('refreshes sessions, routes to the PDS, and writes with swapRecord', async (t) => {
  const requests: Request[] = [];
  let getRecordCalls = 0;
  const putRecordBodies: Record<string, unknown>[] = [];

  t.mock.method(globalThis, 'fetch', async (
    input: Parameters<typeof fetch>[0],
    init?: RequestInit,
  ) => {
    const request = new Request(input, init);
    requests.push(request.clone());
    const url = new URL(request.url);

    if (url.pathname.endsWith('/com.atproto.server.createSession')) {
      return jsonResponse({
        accessJwt: 'access-old',
        refreshJwt: 'refresh-old',
        handle: 'alice.test',
        did: accountDid,
        didDoc: {
          id: accountDid,
          service: [{
            id: '#atproto_pds',
            type: 'AtprotoPersonalDataServer',
            serviceEndpoint: 'https://pds.test',
          }],
        },
      });
    }

    if (url.pathname.endsWith('/com.atproto.server.refreshSession')) {
      assert.equal(request.headers.get('authorization'), 'Bearer refresh-old');
      return jsonResponse({
        accessJwt: 'access-new',
        refreshJwt: 'refresh-new',
        handle: 'alice.test',
        did: accountDid,
        didDoc: {
          id: accountDid,
          service: [{
            id: '#atproto_pds',
            type: 'AtprotoPersonalDataServer',
            serviceEndpoint: 'https://pds.test',
          }],
        },
      });
    }

    if (url.pathname.endsWith('/com.atproto.repo.getRecord')) {
      getRecordCalls += 1;
      assert.equal(url.origin, 'https://pds.test');
      if (getRecordCalls === 1) {
        assert.equal(request.headers.get('authorization'), 'Bearer access-old');
        return jsonResponse(
          { error: 'ExpiredToken', message: 'expired' },
          401,
        );
      }
      assert.equal(request.headers.get('authorization'), 'Bearer access-new');
      return jsonResponse({
        uri: `at://${accountDid}/app.bsky.actor.profile/self`,
        cid: profileCid,
        value: {
          $type: 'app.bsky.actor.profile',
          description: 'original bio',
          customField: 'preserved',
        },
      });
    }

    if (url.pathname.endsWith('/com.atproto.repo.putRecord')) {
      assert.equal(url.origin, 'https://pds.test');
      assert.equal(request.headers.get('authorization'), 'Bearer access-new');
      putRecordBodies.push(
        JSON.parse(await request.text()) as Record<string, unknown>,
      );
      return jsonResponse({
        uri: `at://${accountDid}/app.bsky.actor.profile/self`,
        cid: profileCid,
      });
    }

    throw new Error(`unexpected request: ${request.method} ${request.url}`);
  });

  const service = new BlueskyService(config);
  assert.deepEqual(await service.initialize(), {
    accountDid,
    description: 'original bio',
  });
  assert.deepEqual(
    await service.updateDescription('managed bio', 'original bio'),
    { status: 'updated', description: 'managed bio' },
  );

  assert.equal(getRecordCalls, 3);
  assert.equal(putRecordBodies[0]?.swapRecord, profileCid);
  assert.deepEqual(putRecordBodies[0]?.record, {
    $type: 'app.bsky.actor.profile',
    description: 'managed bio',
    customField: 'preserved',
  });
  assert.ok(requests.some((request) =>
    request.url.includes('com.atproto.server.refreshSession')));
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
