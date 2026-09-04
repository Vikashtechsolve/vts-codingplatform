const {
  collectHlsRefs,
  applyHlsRefs,
  rewritePlaylistToProxy,
} = require('./courseHlsPlaylist');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

const vod = [
  '#EXTM3U',
  '#EXT-X-VERSION:3',
  '#EXT-X-TARGETDURATION:6',
  '#EXT-X-PLAYLIST-TYPE:VOD',
  '#EXTINF:6.000000,',
  'seg_000.ts',
  '#EXTINF:6.000000,',
  'seg_001.ts',
  '#EXT-X-ENDLIST',
  '',
].join('\n');

assert(collectHlsRefs(vod).join(',') === 'seg_000.ts,seg_001.ts', 'collect ts refs');

const proxied = rewritePlaylistToProxy(vod, {
  apiBase: 'http://localhost:5000/api/courses-media/c1/lectures/l1/file',
  token: 'tok&en',
});
assert(proxied.includes('name=seg_000.ts'), 'proxy seg 0');
assert(proxied.includes('name=seg_001.ts'), 'proxy seg 1');
assert(proxied.includes('token=tok%26en'), 'encode token');
assert(proxied.includes('#EXT-X-ENDLIST'), 'keep tags');
assert(!proxied.includes('\nseg_000.ts\n'), 'no raw relative segment');

const mapped = applyHlsRefs(vod, {
  'seg_000.ts': 'https://r2.example/seg_000.ts?sig=1',
  'seg_001.ts': 'https://r2.example/seg_001.ts?sig=2',
});
assert(mapped.includes('https://r2.example/seg_000.ts?sig=1'), 'signed url 0');
assert(mapped.includes('https://r2.example/seg_001.ts?sig=2'), 'signed url 1');

const keyed = '#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\nseg_000.ts\n';
assert(collectHlsRefs(keyed).includes('key.bin'), 'collect key uri');
assert(
  applyHlsRefs(keyed, { 'key.bin': 'https://api/key', 'seg_000.ts': 'https://api/seg' }).includes(
    'URI="https://api/key"'
  ),
  'rewrite key uri'
);

console.log('courseHlsPlaylist.test.js: all passed');
