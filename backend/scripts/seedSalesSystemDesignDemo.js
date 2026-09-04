/**
 * Seed 5 demo-quality system design problems for sales@skilltrixa.com.
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const User = require('../models/User');
const SystemDesignProblem = require('../models/SystemDesignProblem');

const SOURCE_EMAIL = 'sales@skilltrixa.com';

const TITLES = [
  'Design a Distributed Rate Limiter',
  'Design a Real-Time Chat System like WhatsApp',
  'Design a Ride-Sharing Platform like Uber',
  'Design a Video Streaming Service like YouTube',
  'Design a Food Delivery Platform like Swiggy',
];

const DEFAULT_WEIGHTS = {
  requirements: 10,
  capacityEstimation: 10,
  coreEntities: 8,
  apiDesign: 10,
  architecture: 18,
  dataFlow: 8,
  databaseDesign: 12,
  scalingStrategy: 10,
  deepDive: 7,
  tradeoffs: 7,
};

const hint = (text, penaltyPercent = 5) => ({ text, penaltyPercent });

function p(html) {
  return html;
}

function makeProblem(base, vendorId, createdBy) {
  return {
    ...base,
    vendorId,
    createdBy,
    source: 'vendor',
    isGlobal: false,
    isActive: true,
    assignedTo: [],
    assignedClassrooms: [],
    totalAssigned: 0,
    totalSubmitted: 0,
    totalEvaluated: 0,
    sectionWeights: { ...DEFAULT_WEIGHTS },
    evaluationConfig: {
      strictness: 'moderate',
      model: '',
      enableFollowUp: true,
      followUpCount: 3,
    },
    architectureTemplates: [],
  };
}

function problems() {
  return [
    {
      title: TITLES[0],
      category: 'rate_limiter',
      difficulty: 'easy',
      duration: 60,
      businessContext:
        '<p>You are designing the rate-limiting layer in front of a public REST API used by a campus hiring platform. Partners and students share API keys. Abuse (scraping, credential stuffing, noisy retries) must be contained without blocking legitimate traffic during a placement drive.</p>',
      problemStatement: `
<p>Design a <strong>distributed rate limiter</strong> that can be placed in front of an API gateway serving many backend services.</p>
<h3>Functional requirements</h3>
<ul>
<li>Enforce per-API-key and per-IP limits (for example 100 requests / minute).</li>
<li>Support at least one algorithm: token bucket or sliding window.</li>
<li>Return HTTP 429 with a Retry-After hint when the limit is exceeded.</li>
<li>Allow different limits for different routes (login vs search vs submit).</li>
<li>Work correctly when the API runs on many instances behind a load balancer.</li>
</ul>
<h3>Non-functional requirements</h3>
<ul>
<li>Decision path should add very little latency (ideally under 5 ms p99 in the same region).</li>
<li>Limits must be approximately correct across instances (eventual small skew is acceptable; large bypass is not).</li>
<li>The limiter itself should fail open or fail closed according to a documented policy — state your choice.</li>
</ul>
<p>Out of scope: a full WAF, bot detection ML, or billing.</p>
      `.trim(),
      constraints: {
        estimatedUsers: '50K API keys, 2M unique IPs / day during drives',
        estimatedQPS: '20K requests/sec peak, 3K writes to limiter state/sec',
        storageNeeds: 'Hot counters in memory/Redis; days of audit logs optional',
        latencyRequirement: '< 5ms extra for allow/deny in-region',
        availabilityTarget: '99.95% for the limiter path',
      },
      dataFlowScenarios: [
        'Allow path: request hits gateway, limiter checks Redis counter, request is forwarded',
        'Deny path: counter exceeded, 429 returned without calling the origin',
        'Config change: ops updates route limit, all instances pick up new quota within seconds',
      ],
      deepDiveOptions: [
        'Token bucket vs sliding window vs leaky bucket',
        'Redis vs local + gossip counters',
        'Fail-open vs fail-closed',
        'Hot keys and sharding',
        'Clock skew and sliding windows',
      ],
      validationRules: {
        requireLoadBalancer: true,
        requireCache: true,
        requireMessageQueue: false,
        requireCDN: false,
        requireDatabase: true,
        requireAPIGateway: true,
        customRules: ['Must reason about multi-instance consistency of counters'],
      },
      hints: {
        requirements: [hint('Separate per-key, per-IP, and per-route limits; mention 429.')],
        capacityEstimation: [hint('Estimate QPS × window size to size Redis memory for counters.')],
        coreEntities: [hint('Think: API key, route policy, counter window, decision log.')],
        apiDesign: [hint('Show a check API used by the gateway: allow(key, route) → {allowed, remaining, retryAfter}.')],
        architecture: [hint('Put Redis (or equivalent) next to the gateway; do not store hot counters only in a SQL DB.')],
        dataFlow: [hint('Draw allow vs 429 without hitting origin.')],
        databaseDesign: [hint('Counters are not a good fit for a single-row SQL update under 20K QPS.')],
        scalingStrategy: [hint('Shard Redis by API key hash; watch hot keys like a shared campus NAT IP.')],
        deepDive: [hint('Compare token bucket (burst) with sliding window (smoother).')],
        tradeoffs: [hint('Accuracy vs latency vs memory; fail-open vs fail-closed.')],
      },
      referenceAnswer: {
        requirements: `<h3>Functional</h3><ul><li>Per API key and per IP quotas</li><li>Per-route policies</li><li>429 + Retry-After</li><li>Token bucket or sliding window</li></ul><h3>Non-functional</h3><ul><li>Sub-5ms in-region</li><li>Correct enough across many gateway replicas</li><li>Documented fail-open (availability) vs fail-closed (safety) policy</li></ul>`,
        capacityEstimation: `<p>Peak 20K QPS. For a 60s sliding window you need on the order of unique keys active in that minute, not 20K × 60 rows if you keep one counter per key per window. Memory is dominated by active keys: if 200K keys are hot, a compact counter + TTL is tens of MB in Redis — fine. Audit logs at 20K events/sec need sampling or async write. Network: a Redis GET/INCR per request is acceptable in the same AZ.</p>`,
        coreEntities: `<ul><li>ApiKey / Client</li><li>RateLimitPolicy (route, algorithm, quota, window)</li><li>Counter (key, windowId, tokens or count)</li><li>DecisionEvent (optional, sampled)</li></ul>`,
        apiDesign: `<pre>POST /internal/ratelimit/check
{ "apiKey": "...", "ip": "...", "route": "POST /submit" }
→ { "allowed": true, "remaining": 42, "resetAt": 1710000060 }

Headers to client: X-RateLimit-Remaining, Retry-After on 429</pre>`,
        architecture: `<p>Client → L7 load balancer → API gateway instances. Each instance calls a Redis cluster (or Redis Cluster) with INCR/EXPIRE or a Lua token-bucket script for atomicity. Policy config lives in a small DB/config service, cached in memory on each gateway with short TTL. Do not put the hot path on a single SQL row. Optional local in-process limiter for extreme load, synced periodically (accepts more drift).</p>`,
        dataFlow: `<p><strong>Allow:</strong> gateway hashes key, INCR window counter, if under quota forward to service.<br/><strong>Deny:</strong> return 429, no origin call.<br/><strong>Policy update:</strong> admin writes config; gateways refresh cache.</p>`,
        databaseDesign: `<p>Hot state: Redis keys like <code>rl:{apiKey}:{route}:{window}</code> with TTL = window. Policy table in Postgres/etcd: route, limit, algorithm. Optional Cassandra/ClickHouse for sampled denies. Avoid strong consistency SQL for every request.</p>`,
        scalingStrategy: `<p>Shard Redis by key. Replicate for HA. For NAT-shared campus IPs, prefer API-key limits over IP. Horizontal scale gateways independently of Redis. Circuit-break Redis: fail-open for public catalog GETs, fail-closed for login/submit if that is the security policy.</p>`,
        deepDive: `<p>Token bucket allows controlled bursts (good for page loads). Sliding window is smoother but needs more state or approximated log. Fixed window is simplest but stampeding at window edges. Lua in Redis keeps check+increment atomic. Clock skew: use Redis server time. Hot key: a popular public route may need a local limiter plus a coarser global quota.</p>`,
        tradeoffs: `<ul><li>Strong global accuracy vs extra RTT to Redis</li><li>Fail-open (uptime) vs fail-closed (abuse)</li><li>Per-IP limits vs shared NAT fairness</li><li>Memory of precise windows vs approximate count-min sketches at huge cardinality</li></ul>`,
      },
    },
    {
      title: TITLES[1],
      category: 'chat_system',
      difficulty: 'medium',
      duration: 75,
      businessContext:
        '<p>A placement-prep product wants 1:1 and small group chat between mentors and students, with delivery receipts and media. You are not building a full social network.</p>',
      problemStatement: `
<p>Design a <strong>real-time messaging system</strong> comparable to WhatsApp for 1:1 and small groups (up to 256 members).</p>
<h3>Functional requirements</h3>
<ul>
<li>Send and receive text messages with low latency when both users are online.</li>
<li>Offline inbox: messages are delivered when the user reconnects.</li>
<li>Delivery and read receipts (sent / delivered / read) for 1:1.</li>
<li>Group chat: fan-out to members; last-N messages on open.</li>
<li>Optional: image attachments via object storage (not in the chat DB as blobs).</li>
</ul>
<h3>Non-functional</h3>
<ul>
<li>Online p95 delivery under 200 ms in-region.</li>
<li>At-least-once delivery is acceptable if the client is idempotent on messageId.</li>
<li>Ordering: per-conversation causal/order for 1:1; document group-ordering choice.</li>
</ul>
<p>Out of scope: end-to-end encryption implementation details, voice/video calls, status stories.</p>
      `.trim(),
      constraints: {
        estimatedUsers: '10M registered, 1M DAU, 200K concurrent websocket connections',
        estimatedQPS: '30K messages/sec peak send, 100K fanout deliveries/sec in groups',
        storageNeeds: 'Message history 2 years; ~50 bytes metadata + media in object store',
        latencyRequirement: '< 200ms p95 online delivery in-region',
        availabilityTarget: '99.9% messaging API, graceful reconnect',
      },
      dataFlowScenarios: [
        'Online 1:1: sender → chat service → websocket push to recipient',
        'Offline 1:1: persist message, push on reconnect, then receipt updates',
        'Group message: persist once, fan-out to online members, inbox for offline',
      ],
      deepDiveOptions: [
        'Websocket vs long-polling vs MQTT',
        'Fan-out on write vs fan-out on read for groups',
        'Message ordering and idempotency',
        'Unread counters and receipts',
        'Media upload pipeline',
      ],
      validationRules: {
        requireLoadBalancer: true,
        requireCache: true,
        requireMessageQueue: true,
        requireCDN: false,
        requireDatabase: true,
        requireAPIGateway: true,
        customRules: ['Must include a persistent inbox for offline users'],
      },
      hints: {
        requirements: [hint('Cover online, offline, receipts, and group fan-out.')],
        capacityEstimation: [hint('Separate send QPS from fan-out QPS in groups.')],
        coreEntities: [hint('User, Conversation, Message, Device/Connection, Receipt.')],
        apiDesign: [hint('REST for history; websocket for live send/receive.')],
        architecture: [hint('Connection service (sticky WS) + chat service + store + queue for fan-out.')],
        dataFlow: [hint('Show persist-then-push so a crash after ACK still has the message.')],
        databaseDesign: [hint('Partition messages by conversationId; do not store media bytes in SQL.')],
        scalingStrategy: [hint('Shard connection nodes; use a pub/sub so the recipient’s node gets the event.')],
        deepDive: [hint('Large groups: fan-out on write is expensive; hybrid with fan-out on read.')],
        tradeoffs: [hint('At-least-once vs exactly-once; SQL vs Cassandra/Dynamo for history.')],
      },
      referenceAnswer: {
        requirements: `<ul><li>1:1 and groups ≤256</li><li>Online realtime + offline inbox</li><li>Sent/delivered/read for 1:1</li><li>Media via object storage</li><li>Idempotent messageId</li></ul><p>NFRs: 200ms p95, 99.9%, at-least-once OK.</p>`,
        capacityEstimation: `<p>1M DAU, 200K concurrent sockets. 30K sends/sec. A group of 50 with 10% online still multiplies deliveries. Storage: 30K msg/sec × 86400 × 200 bytes ≈ 500 GB/day raw if every message is stored once; index and replication multiply this — plan compaction and TTL for media thumbnails. Websocket fleet: 200K conns / 20K per node ≈ 10+ connection nodes plus headroom.</p>`,
        coreEntities: `<ul><li>User, Device</li><li>Conversation (type 1:1 or group, member list)</li><li>Message (id, conversationId, senderId, seq, body, mediaRef, createdAt)</li><li>DeliveryReceipt / ReadCursor</li><li>ConnectionSession (nodeId, userId)</li></ul>`,
        apiDesign: `<pre>WS /ws/chat  {type: send, conversationId, clientMsgId, body}
REST GET /conversations/{id}/messages?before=seq&limit=50
REST POST /media/upload-url
Server events: message, receipt, typing</pre>`,
        architecture: `<p>Clients keep a websocket to a connection layer (sticky by user). Chat service authenticates, assigns seq, writes the message store, then publishes to a queue/pubsub. The connection layer on the recipient’s node pushes the event. Offline users only get the durable row. Object storage + CDN for images. Redis for presence and unread counts. Load balancer for HTTP; WS needs idle timeouts and reconnect with backoff.</p>`,
        dataFlow: `<p>Send: validate → persist message (source of truth) → ACK sender with server id/seq → publish → push if online. Receipts are separate small writes. Group: one persist, N notifications (or lazy fan-out on read for huge groups — but 256 is small enough for write fan-out).</p>`,
        databaseDesign: `<p>Messages partitioned by conversationId, clustered by seq/time. Cassandra/Dynamo/Mongo are common; Postgres with partitioning also works at this scale if you are careful. Conversation membership in SQL/Redis. Unread counters in Redis with DB fallback. Media metadata in DB, bytes in S3/R2. Unique (senderId, clientMsgId) for idempotency.</p>`,
        scalingStrategy: `<p>Scale connection nodes horizontally; use Redis pub/sub or Kafka so any node can emit to the node holding the socket. Shard message DB by conversation. Cache recent conversations. Multi-region: store in the user’s region; cross-region chat is harder (higher latency, conflict). Presence TTLs so stale sockets die.</p>`,
        deepDive: `<p>Ordering: per-conversation monotonic seq assigned by the chat service (or conversation shard). Do not rely on client clocks. Groups of 256: fan-out on write is fine. Receipts: don’t write a row per recipient per message in a hot SQL table — use counters + last-read seq. Media: client uploads to signed URL, then sends message with object key after upload completes.</p>`,
        tradeoffs: `<ul><li>At-least-once delivery + idempotent clients vs heavy exactly-once</li><li>Fan-out on write (low read latency) vs fan-out on read (cheaper writes)</li><li>SQL simplicity vs wide-column scale</li><li>Sticky WS sessions vs fully stateless (harder push)</li></ul>`,
      },
    },
    {
      title: TITLES[2],
      category: 'ride_sharing',
      difficulty: 'hard',
      duration: 90,
      businessContext:
        '<p>A city-wide ride-hailing product needs to match riders with nearby drivers in seconds, with live location, fares, and cancellations. This is a classic hard system-design interview problem.</p>',
      problemStatement: `
<p>Design a <strong>ride-sharing platform</strong> like Uber / Ola for one metro city first, with a path to more cities.</p>
<h3>Functional requirements</h3>
<ul>
<li>Rider requests a ride (pickup, drop, vehicle type).</li>
<li>System matches a nearby available driver within a few seconds.</li>
<li>Driver accepts/rejects; rider sees ETA and live location during the trip.</li>
<li>Trip lifecycle: requested → matched → ongoing → completed / cancelled.</li>
<li>Fare estimate up front; final fare after trip with a payment intent.</li>
</ul>
<h3>Non-functional</h3>
<ul>
<li>Match p95 under 5 seconds in the city.</li>
<li>Location updates every 2–4 seconds during a trip without melting the DB.</li>
<li>99.9% availability for request/match; location can be slightly stale.</li>
</ul>
<p>Out of scope: full multi-country tax, driver onboarding KYC workflows, surge ML model training.</p>
      `.trim(),
      constraints: {
        estimatedUsers: '1M riders, 50K drivers in one city; 15K concurrent trips peak',
        estimatedQPS: '200 ride requests/sec peak; 20K location updates/sec',
        storageNeeds: 'Trip history years; location is hot and ephemeral',
        latencyRequirement: 'Match < 5s p95; location map < 2s freshness',
        availabilityTarget: '99.9% request/match',
      },
      dataFlowScenarios: [
        'Happy path: request → nearby search → offer to driver → accept → trip start → complete → payment',
        'No drivers: expand radius / queue / fail with retry',
        'Cancel: rider cancels after match; notify driver; free driver state',
      ],
      deepDiveOptions: [
        'Geospatial indexing (geohash vs quadtree vs Redis GEO)',
        'Matching algorithm and fairness',
        'Location update pipeline',
        'Cancellation and state machine',
        'Payments and idempotency',
      ],
      validationRules: {
        requireLoadBalancer: true,
        requireCache: true,
        requireMessageQueue: true,
        requireCDN: false,
        requireDatabase: true,
        requireAPIGateway: true,
        customRules: ['Must address geospatial search and a trip state machine'],
      },
      hints: {
        requirements: [hint('Include match, live location, trip states, and fare — not only a map.')],
        capacityEstimation: [hint('Location QPS will dwarf ride-request QPS; treat them differently.')],
        coreEntities: [hint('Rider, Driver, Vehicle, Trip, LocationPing, PaymentIntent.')],
        apiDesign: [hint('REST for request/cancel; websocket or push for match and location.')],
        architecture: [hint('Split matching service, location service, trip service, payments.')],
        dataFlow: [hint('Driver availability must be updated atomically with accept.')],
        databaseDesign: [hint('Do not write every GPS ping to Postgres as the source of truth.')],
        scalingStrategy: [hint('Shard by city/geohash; isolate location ingestion.')],
        deepDive: [hint('Redis GEO or geohash grids for nearby drivers.')],
        tradeoffs: [hint('Match quality vs latency; GPS accuracy vs battery/network.')],
      },
      referenceAnswer: {
        requirements: `<ul><li>Request ride, match nearby driver, accept/reject</li><li>Trip state machine and live location</li><li>Estimate + final fare, payment intent</li><li>Cancel paths</li></ul><p>NFR: match &lt; 5s, location pipeline scaled separately.</p>`,
        capacityEstimation: `<p>200 requests/sec is modest. 20K location updates/sec is the hot path: 20K writes/sec to Redis/stream, not to a single SQL table. 15K concurrent trips × 1 ping / 3s ≈ 5K pings/sec from trips plus idle driver pings. Disk: trip rows are small; GPS history if stored should be sampled or sent to a time-series store / cold object log.</p>`,
        coreEntities: `<ul><li>Rider, Driver (status: offline/idle/enroute/ontrip)</li><li>Trip (state, pickup, drop, fares)</li><li>Location (driverId, lat, lng, ts) in a geo index</li><li>PaymentIntent</li></ul>`,
        apiDesign: `<pre>POST /rides  {pickup, drop, product}
GET  /rides/{id}
POST /rides/{id}/cancel
POST /drivers/location  {lat,lng,heading}  (high frequency)
WS   /rides/{id}/events  match, eta, location, completed</pre>`,
        architecture: `<p>API gateway → Ride service (state machine) → Matching service that queries a Location service (Redis GEO / geohash buckets). Drivers stream locations to an ingestion tier (Kafka) then a memory geo index. Notifications (push) for offers. Payments service with idempotency keys. Map tiles from a provider/CDN. Do not run matching as a full table scan of all drivers.</p>`,
        dataFlow: `<p>Request creates Trip=requested. Matcher pulls idle drivers in expanding geohash rings, ranks by ETA, offers one (or a small set). On accept, Trip=matched, driver status locked. Pings during trip go to riders via pub/sub. Complete computes fare and creates payment. Cancel releases driver and records reason. Use optimistic locking on driver status to prevent double match.</p>`,
        databaseDesign: `<p>Trips and users in SQL/NewSQL for money and audits. Location: Redis GEO or in-memory grid, TTL. Optional Cassandra for ping history. Idempotency table for payments. Indexes: trip by rider, active trip by driver (unique). Never put 20K GPS writes/sec into an unpartitioned RDS instance.</p>`,
        scalingStrategy: `<p>Partition by city. Scale location ingest independently. Autoscale matchers. Cache product types and surge multipliers. If Redis GEO is hot, shard by geohash prefix. Multi-city: separate clusters per city to keep match latency local.</p>`,
        deepDive: `<p>Matching: greedy nearest vs batch matching (fairer, slightly slower). Offer timeout then next driver. Surge as a multiplier on estimate. Location: client-side batching, ignore stale pings, Kalman optional. Payments: authorize at start or at end; refunds on cancel policy. Failure: if matcher dies, trip stays requested and is retried.</p>`,
        tradeoffs: `<ul><li>Fast greedy match vs globally optimal batching</li><li>Fresh GPS vs battery and 20K QPS cost</li><li>SQL source of truth for money vs NoSQL for pings</li><li>Single offer vs blasting many drivers (spam vs speed)</li></ul>`,
      },
    },
    {
      title: TITLES[3],
      category: 'streaming',
      difficulty: 'hard',
      duration: 90,
      businessContext:
        '<p>A training company wants to host lecture videos at scale with resumable playback and multiple qualities, similar to YouTube/Netflix on-demand (not live sports).</p>',
      problemStatement: `
<p>Design a <strong>video-on-demand streaming service</strong> like YouTube (upload, process, watch) for lectures and demos.</p>
<h3>Functional requirements</h3>
<ul>
<li>Creators upload video files; the system transcodes to multiple bitrates (HLS/DASH).</li>
<li>Viewers stream adaptive bitrate playback and resume from last position.</li>
<li>Basic metadata: title, creator, views (approximate is OK).</li>
<li>Thumbnails and a watch page. Search can be simplified (title/tag) unless you want to deep-dive search.</li>
</ul>
<h3>Non-functional</h3>
<ul>
<li>Start playback quickly (first frame / first playlist under a couple of seconds with CDN).</li>
<li>Uploads of multi-GB files must be resumable.</li>
<li>99.9% watch availability via CDN; processing can be async.</li>
</ul>
<p>Out of scope: live streaming, copyright fingerprinting, full ads auction.</p>
      `.trim(),
      constraints: {
        estimatedUsers: '5M MAU, 200K DAU watching, 5K concurrent uploads off-peak',
        estimatedQPS: 'Watch starts 1K/sec peak; segment fetches absorbed by CDN',
        storageNeeds: 'Petabyte-class object storage for mezzanine + renditions',
        latencyRequirement: 'Time-to-first-frame < 2s with warm CDN',
        availabilityTarget: '99.9% playback',
      },
      dataFlowScenarios: [
        'Upload: signed URL → object store → transcode queue → HLS output → publish',
        'Watch: client fetches master playlist from CDN → adaptive segments',
        'Resume: client sends last position; next visit starts near that offset',
      ],
      deepDiveOptions: [
        'Adaptive bitrate and HLS/DASH',
        'CDN caching of segments',
        'Transcode pipeline and idempotency',
        'Resumable uploads',
        'View counters and hot videos',
      ],
      validationRules: {
        requireLoadBalancer: true,
        requireCache: true,
        requireMessageQueue: true,
        requireCDN: true,
        requireDatabase: true,
        requireAPIGateway: true,
        customRules: ['Must include transcoding pipeline and CDN for playback'],
      },
      hints: {
        requirements: [hint('Upload, transcode, ABR playback, resume — not a single MP4 download.')],
        capacityEstimation: [hint('Storage is dominated by multiple renditions, not by QPS of the API.')],
        coreEntities: [hint('Video, Rendition, UploadSession, WatchProgress, Creator.')],
        apiDesign: [hint('Signed upload URLs; GET playback URL that points at CDN.')],
        architecture: [hint('Object storage + worker queue + CDN origin. API is not in the byte path.')],
        dataFlow: [hint('Never stream the original upload as the only format.')],
        databaseDesign: [hint('Metadata in DB; bytes in object storage. Progress is a small KV.')],
        scalingStrategy: [hint('CDN for reads; autoscale transcode workers; pack/hot-pack popular videos.')],
        deepDive: [hint('HLS playlists vs DASH; GOP alignment for ABR switching.')],
        tradeoffs: [hint('More bitrates = better QoE and much more storage/cost.')],
      },
      referenceAnswer: {
        requirements: `<ul><li>Resumable upload</li><li>Async transcode to HLS/DASH ladder</li><li>ABR playback + resume</li><li>Metadata and approximate views</li></ul>`,
        capacityEstimation: `<p>1K watch starts/sec is mostly CDN after the first hit. A 1 hour 1080p + 720p + 480p ladder can be tens of GB per title including audio. 10K hours of new content/month is the storage driver. Transcode is CPU/GPU heavy: queue depth matters more than API QPS. Watch progress writes can be sampled every 5–10s to keep DB load down.</p>`,
        coreEntities: `<ul><li>Video (status: uploading, processing, ready, failed)</li><li>Rendition (bitrate, resolution, playlist key)</li><li>UploadSession (parts, etags)</li><li>WatchProgress (userId, videoId, position)</li></ul>`,
        apiDesign: `<pre>POST /videos → {uploadId, signedUrls[]}
POST /videos/{id}/complete
GET  /videos/{id}  metadata + playback.master.m3u8 (CDN)
PUT  /progress {videoId, seconds}</pre>`,
        architecture: `<p>Client uploads to S3/R2 via multipart signed URLs. Completion enqueues a transcode job (FFmpeg/workers). Output playlists and .ts/.m4s objects go to the origin bucket. CDN (CloudFront/Fastly) caches segments with long TTL; playlists shorter TTL. API/DB only for metadata. Transcode workers consume a queue (SQS/Kafka). Thumbnails generated in the same pipeline.</p>`,
        dataFlow: `<p>Upload parts → complete → job → ladders + master playlist → mark ready. Watch: HTTPS GET playlist from CDN → segments. If origin miss, CDN pulls from bucket. Progress heartbeat updates KV. Views: increment a Redis counter, flush periodically so a viral video does not melt SQL.</p>`,
        databaseDesign: `<p>Postgres for video metadata and ACLs. Object store for all media. Redis for views and hot progress. Unique videoId. Transcode jobs table for retries/idempotency (do not double-bill GPU). Lifecycle rules: delete failed temps, glacier rare titles if needed.</p>`,
        scalingStrategy: `<p>CDN is the scale-out for watch. Autoscale GPU/CPU workers on queue lag. Partition progress by userId. Pre-warm CDN for featured lectures. Multi-region: replicate popular objects; API regional. Rate-limit uploads per creator.</p>`,
        deepDive: `<p>ABR: 360/480/720/1080 ladders, aligned keyframes. HLS is widely supported. Idempotent jobs keyed by videoId+version. Resumable upload: S3 multipart, client retries failed parts. DRM out of scope but mention signed cookies if lectures are paid. Hot video: cache playlist at edge; origin shield to protect the bucket.</p>`,
        tradeoffs: `<ul><li>More renditions vs storage cost</li><li>Fast start (pre-transcode 360p first) vs wait for full ladder</li><li>Exact view counts vs approximate Redis</li><li>Long playlist TTL vs faster quality updates</li></ul>`,
      },
    },
    {
      title: TITLES[4],
      category: 'food_delivery',
      difficulty: 'medium',
      duration: 75,
      businessContext:
        '<p>A city food-delivery marketplace connects restaurants, customers, and couriers. Peak dinner hours create spiky load. Inventory (menu sold-outs) and assignment of riders are the hard parts.</p>',
      problemStatement: `
<p>Design a <strong>food delivery platform</strong> like Swiggy / Zomato for one city.</p>
<h3>Functional requirements</h3>
<ul>
<li>Browse restaurants and menus; place an order with items and address.</li>
<li>Restaurant accepts/rejects; kitchen status updates.</li>
<li>Assign a courier; customer tracks order status (placed → accepted → preparing → picked up → delivered).</li>
<li>Handle item sold-out and restaurant-closed at order time as cleanly as you can.</li>
<li>Payment success before the restaurant is strongly notified (or document an alternative with compensation).</li>
</ul>
<h3>Non-functional</h3>
<ul>
<li>Checkout p95 under 2 seconds excluding payment-provider time.</li>
<li>99.9% for browse; ordering may queue briefly at peak.</li>
<li>Menu reads are heavily cached; order writes must not sell the last item twice without a strategy.</li>
</ul>
<p>Out of scope: restaurant POS hardware, full tax engine, courier routing ML.</p>
      `.trim(),
      constraints: {
        estimatedUsers: '2M customers, 8K restaurants, 15K couriers; 25K orders/hour dinner peak',
        estimatedQPS: 'Browse 8K/sec; checkout 40/sec peak; location 5K/sec',
        storageNeeds: 'Orders retained 7 years for compliance; menus change often',
        latencyRequirement: 'Browse < 200ms cached; checkout < 2s p95 app-side',
        availabilityTarget: '99.9% catalog, 99.5% checkout',
      },
      dataFlowScenarios: [
        'Happy path: pay → restaurant accept → courier assign → pickup → deliver',
        'Sold out: restaurant marks item unavailable; checkout rejects or substitutes',
        'Payment success but restaurant reject: refund / compensate',
      ],
      deepDiveOptions: [
        'Menu caching vs inventory correctness',
        'Order state machine',
        'Courier assignment',
        'Payments and refunds',
        'Peak dinner load shedding',
      ],
      validationRules: {
        requireLoadBalancer: true,
        requireCache: true,
        requireMessageQueue: true,
        requireCDN: true,
        requireDatabase: true,
        requireAPIGateway: true,
        customRules: ['Must discuss catalog cache vs overselling'],
      },
      hints: {
        requirements: [hint('Include restaurant accept, courier, and payment/refund, not only a cart.')],
        capacityEstimation: [hint('Browse QPS is cacheable; checkout QPS is the write bottleneck.')],
        coreEntities: [hint('Customer, Restaurant, MenuItem, Order, OrderItem, Courier, Payment.')],
        apiDesign: [hint('Idempotent POST /orders with an Idempotency-Key.')],
        architecture: [hint('Catalog service (cached) separate from Order service (source of truth).')],
        dataFlow: [hint('Do not notify the kitchen until payment is confirmed — or describe saga compensation.')],
        databaseDesign: [hint('Orders are transactional; menus can be a document or cached rows.')],
        scalingStrategy: [hint('Read replicas/CDN for images; shard orders by city/date.')],
        deepDive: [hint('Soft inventory vs locking the last unit; courier dispatch queue per geo cell.')],
        tradeoffs: [hint('Stale menu cache vs always hitting the restaurant system of record.')],
      },
      referenceAnswer: {
        requirements: `<ul><li>Browse + cart + pay</li><li>Restaurant accept and kitchen states</li><li>Courier assign and tracking</li><li>Sold-out handling</li><li>Refund if restaurant rejects after pay</li></ul>`,
        capacityEstimation: `<p>8K browse/sec should be 95%+ cache hits (Redis + CDN for images). 25K orders/hour ≈ 7 orders/sec average, 40/sec peak — small for a well-indexed order DB, but each order fans out to restaurant devices, SMS, and dispatch. Courier GPS similar to ride-sharing but lower concurrency. Store menus in cache with version tokens so checkout can detect staleness.</p>`,
        coreEntities: `<ul><li>Restaurant, Menu, MenuItem (available, price, version)</li><li>Order, OrderItem, OrderStatusHistory</li><li>Courier, Assignment</li><li>Payment (intent, capture, refund)</li></ul>`,
        apiDesign: `<pre>GET /restaurants?geo=
GET /restaurants/{id}/menu
POST /orders  Idempotency-Key
POST /orders/{id}/cancel
WS or push: status, courier location</pre>`,
        architecture: `<p>CDN + catalog API (heavy cache). Order service owns the state machine and writes to SQL. Payment service. Restaurant device gateway. Dispatch service uses geo cells + a queue. Notification via push/SMS. Images on object storage/CDN. Search for restaurants can be Elasticsearch later; start with geo + cuisine filters on indexed fields.</p>`,
        dataFlow: `<p>Checkout: validate menu version → create payment → on success create Order=paid → enqueue restaurant. If restaurant rejects, refund saga. Dispatch listens for preparing/ready, assigns courier, updates status. Customer poll or push. Use outbox/queue so a crash after pay still notifies the restaurant.</p>`,
        databaseDesign: `<p>Postgres for orders (ACID, money). Unique idempotency key. Menu in Postgres or document store, cached. Inventory: decrement remaining_qty in a transaction or accept oversell + compensate (document the choice). Courier location in Redis GEO. Event log for status for audit.</p>`,
        scalingStrategy: `<p>Cache menus by restaurantId with short TTL plus pub/sub invalidation when kitchen marks sold-out. Shard/partition orders by day + city. Autoscale dispatch workers at dinner. Rate-limit checkout per user. Read replicas for restaurant dashboards.</p>`,
        deepDive: `<p>Oversell: compare-and-swap remaining_qty or serialize last-unit orders per item. Courier assignment: nearest available in a geohash, with timeout then reassign. Peak: degrade browse personalization, keep checkout. Payments: never double-charge (idempotency). Restaurant offline: stop taking orders via a flag in cache immediately.</p>`,
        tradeoffs: `<ul><li>Fresh inventory vs cache hit ratio</li><li>Pay-then-accept vs accept-then-pay (conversion vs refund ops)</li><li>Oversell + compensate vs slower locked checkout</li><li>Push notifications vs battery vs polling</li></ul>`,
      },
    },
  ];
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const admin = await User.findOne({ email: SOURCE_EMAIL, role: 'vendor_admin', isActive: true });
  if (!admin?.vendorId) throw new Error(`Vendor admin not found: ${SOURCE_EMAIL}`);
  const vendorId = admin.vendorId;
  const createdBy = admin._id;

  const existing = await SystemDesignProblem.find({ vendorId, title: { $in: TITLES } })
    .select('title')
    .lean();
  if (existing.length) {
    throw new Error(`Demo problems already exist: ${existing.map((p) => p.title).join('; ')}`);
  }

  const docs = problems().map((p) => makeProblem(p, vendorId, createdBy));
  const SECTION_KEYS = [
    'requirements', 'capacityEstimation', 'coreEntities', 'apiDesign',
    'architecture', 'dataFlow', 'databaseDesign', 'scalingStrategy', 'deepDive', 'tradeoffs',
  ];
  for (const doc of docs) {
    for (const key of SECTION_KEYS) {
      const ref = doc.referenceAnswer?.[key];
      if (!ref || !String(ref).replace(/<[^>]+>/g, '').trim()) {
        throw new Error(`${doc.title} missing referenceAnswer.${key}`);
      }
    }
  }

  console.log(`Inserting ${docs.length} system design problems...`);
  const created = await SystemDesignProblem.insertMany(docs);

  const verify = await SystemDesignProblem.find({ vendorId, title: { $in: TITLES } }).lean();
  if (verify.length !== 5) throw new Error(`Expected 5 problems, found ${verify.length}`);

  for (const p of verify) {
    if (p.source !== 'vendor') throw new Error(`${p.title} source=${p.source}`);
    if (String(p.vendorId) !== String(vendorId)) throw new Error(`${p.title} wrong vendor`);
    if ((p.assignedTo || []).length) throw new Error(`${p.title} has assigned students`);
    if ((p.assignedClassrooms || []).length) throw new Error(`${p.title} has assigned classrooms`);
    if (!p.isActive) throw new Error(`${p.title} inactive`);
    for (const key of SECTION_KEYS) {
      const ref = p.referenceAnswer?.[key];
      if (!ref || !String(ref).replace(/<[^>]+>/g, '').trim()) {
        throw new Error(`${p.title} empty ref ${key}`);
      }
    }
  }

  console.log(JSON.stringify({
    ok: true,
    problems: verify.map((p) => ({
      title: p.title,
      category: p.category,
      difficulty: p.difficulty,
      duration: p.duration,
      scenarios: p.dataFlowScenarios?.length,
      assigned: p.assignedTo?.length || 0,
    })),
  }, null, 2));

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('\nSEED FAILED:', err);
  try {
    await mongoose.disconnect();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
