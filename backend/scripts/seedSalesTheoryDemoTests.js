/**
 * Seed 5 demo-quality theory tests for sales@skilltrixa.com.
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Test = require('../models/Test');
const Subject = require('../models/Subject');
const Topic = require('../models/Topic');
const TheoryQuestion = require('../models/TheoryQuestion');

const SOURCE_EMAIL = 'sales@skilltrixa.com';
const TAG = 'demo-theory';

const TEST_SPECS = [
  'Campus Placement — Core CS Theory Paper',
  'Operating Systems Theory Assessment',
  'DBMS Theory Assessment',
  'Computer Networks Theory Paper',
  'OOP & Software Design Theory Test',
];

const SUBJECTS = {
  os: { name: 'Operating System', description: 'Process management, memory, scheduling, and concurrency' },
  dbms: { name: 'DBMS', description: 'Relational databases, transactions, and query design' },
  cn: { name: 'Computer Networks', description: 'Layered models, protocols, and internet applications' },
  oop: { name: 'OOP', description: 'Object-oriented programming and software design' },
  cloud: { name: 'Cloud Computing', description: 'Cloud service and deployment models' },
};

async function ensureSubject(vendorId, createdBy, { name, description }) {
  const existing = await Subject.findOne({ vendorId, name });
  if (existing) return existing;
  return Subject.create({ name, description: description || '', vendorId, createdBy, isActive: true });
}

async function ensureTopic(vendorId, createdBy, subjectId, name) {
  const existing = await Topic.findOne({ vendorId, subjectId, name });
  if (existing) return existing;
  return Topic.create({ name, subjectId, vendorId, createdBy, isActive: true });
}

function byKey(docs, defs) {
  const map = {};
  defs.forEach((def, i) => {
    map[def.key] = docs[i];
  });
  return map;
}

function pick(map, keys) {
  return keys.map((k) => {
    if (!map[k]) throw new Error(`Missing question key ${k}`);
    return map[k];
  });
}

function questionDefs() {
  return [
    {
      key: 'os_deadlock',
      subject: 'os',
      topic: 'Deadlock',
      questionText: 'Explain deadlock in an operating system. State the four necessary conditions and compare deadlock prevention, avoidance, and detection-and-recovery. Mention Banker’s algorithm in the right category.',
      difficulty: 'medium',
      maxMarks: 12,
      expectedAnswerLength: 200,
      keywords: ['deadlock', 'mutual exclusion', 'hold and wait', 'no preemption', 'circular wait', 'prevention', 'avoidance', 'banker', 'detection'],
      evaluationRubric: 'Full marks require a clear definition, all four Coffman conditions, and a correct mapping of prevention / avoidance (Banker) / detection-recovery. Deduct if Banker is placed under prevention.',
      referenceAnswer:
        'Deadlock is a permanent blocking of a set of processes where each process holds a resource and waits for a resource held by another process in the set, so none can proceed. Four conditions must hold together: mutual exclusion (a resource is non-shareable), hold and wait (a process holds resources while waiting for more), no preemption (resources cannot be forcibly taken), and circular wait (a cycle of wait-for edges). Prevention designs the system so at least one condition never holds, for example by forcing processes to request all resources at once or by imposing a global resource order to break circular wait. Avoidance allows the four conditions in principle but grants a request only if the resulting state is safe; Banker’s algorithm is the classic avoidance method. Detection and recovery allow deadlocks, run a wait-for-graph or similar detector, then abort or preempt a victim. A strong answer also notes that prevention can reduce concurrency, while detection needs a recovery policy.',
      tags: [TAG, 'OS', 'deadlock'],
    },
    {
      key: 'os_scheduling',
      subject: 'os',
      topic: 'CPU Scheduling',
      questionText: 'Compare FCFS, SJF, Round Robin, and Priority CPU scheduling. For each, state one strength, one weakness, and a situation where it is a reasonable choice. Explain convoy effect and waiting time briefly.',
      difficulty: 'medium',
      maxMarks: 12,
      expectedAnswerLength: 200,
      keywords: ['FCFS', 'SJF', 'round robin', 'priority', 'convoy effect', 'waiting time', 'time quantum', 'starvation'],
      evaluationRubric: 'Need all four algorithms with a trade-off each, plus convoy effect under FCFS and starvation/ageing for priority. Partial credit if only definitions are listed with no trade-offs.',
      referenceAnswer:
        'FCFS runs jobs in arrival order. It is simple and fair in the sense of no starvation, but a long job at the head causes the convoy effect: short jobs wait behind it, so average waiting time can be high. It suits batch work where jobs are similar in length. SJF (or SRTF if preemptive) picks the shortest burst next, which minimises average waiting time, but needs burst estimates and can starve long jobs. Round Robin gives each ready job a time quantum in a cycle, which is good for time-sharing and interactive systems; a quantum that is too small increases context-switch overhead, and one that is too large behaves like FCFS. Priority scheduling serves high-priority work first (for example kernel tasks); without ageing, low-priority jobs can starve. Waiting time is the time a process spends in the ready queue. A complete answer mentions preemption where it changes the behaviour (SRTF, preemptive priority, RR).',
      tags: [TAG, 'OS', 'scheduling'],
    },
    {
      key: 'os_process_thread',
      subject: 'os',
      topic: 'Process Management',
      questionText: 'Differentiate a process and a thread. Explain user-level vs kernel-level threads, and why a multi-threaded server can outperform a multi-process one for many concurrent connections. Mention one risk of sharing an address space.',
      difficulty: 'easy',
      maxMarks: 10,
      expectedAnswerLength: 160,
      keywords: ['process', 'thread', 'address space', 'PCB', 'user-level thread', 'kernel-level thread', 'context switch'],
      evaluationRubric: 'Must contrast address space / PCB vs shared memory among threads, give a valid concurrency benefit, and name a risk such as races or one thread crashing others.',
      referenceAnswer:
        'A process is an executing program with its own address space, open files, and a process control block. A thread is a unit of execution inside a process; threads of the same process share code, heap, and global data, but have their own stack and register state. Creating or switching threads is typically cheaper than creating or switching processes because the address space is already mapped. User-level threads are scheduled in user space (fast, but a blocking syscall can stall the whole process). Kernel-level threads are visible to the OS, so one thread can block while others run. A multi-threaded server can handle many connections with less memory and cheaper context switches than one process per connection. The risk of a shared address space is that a bug, data race, or crash in one thread can corrupt memory used by the others.',
      tags: [TAG, 'OS', 'threads'],
    },
    {
      key: 'os_paging',
      subject: 'os',
      topic: 'Memory Management',
      questionText: 'Explain paging. How does a page table map virtual addresses to physical frames? Contrast paging with segmentation, and explain internal vs external fragmentation in this context. What is a TLB used for?',
      difficulty: 'medium',
      maxMarks: 10,
      expectedAnswerLength: 180,
      keywords: ['paging', 'page table', 'frame', 'virtual address', 'segmentation', 'internal fragmentation', 'external fragmentation', 'TLB'],
      evaluationRubric: 'Require virtual-to-physical translation, page vs frame, TLB as a cache of translations, and a correct fragmentation contrast (paging: internal; segmentation: external).',
      referenceAnswer:
        'Paging divides virtual memory into fixed-size pages and physical memory into frames of the same size. A virtual address splits into a page number and an offset. The page number indexes a page table whose entry gives the frame number (or a fault if the page is not resident); the offset is unchanged. This avoids fitting variable-sized chunks into memory, so external fragmentation is largely eliminated, but the last page of a process may be only partly used (internal fragmentation). Segmentation divides the address space into variable-sized logical units (code, stack, heap). It matches the programmer’s view but can suffer external fragmentation as holes appear. A TLB (translation lookaside buffer) is a small hardware cache of recent page-table entries so the CPU does not walk the page table on every access. Multi-level page tables are used so the table itself does not consume huge contiguous memory.',
      tags: [TAG, 'OS', 'memory'],
    },
    {
      key: 'os_sync',
      subject: 'os',
      topic: 'Synchronization',
      questionText: 'What is a critical section? Explain mutual exclusion, progress, and bounded waiting. Compare a mutex lock with a counting semaphore, and give one valid use of each in an operating system or application.',
      difficulty: 'medium',
      maxMarks: 10,
      expectedAnswerLength: 170,
      keywords: ['critical section', 'mutual exclusion', 'progress', 'bounded waiting', 'mutex', 'semaphore', 'race condition'],
      evaluationRubric: 'Need a correct critical-section definition, the three requirements, and a real distinction (mutex is binary ownership; counting semaphore tracks a pool of resources).',
      referenceAnswer:
        'A critical section is a code region that accesses shared data and must not be executed concurrently by two threads in a conflicting way. A correct solution provides mutual exclusion (only one thread in the section), progress (the decision of who enters next cannot be postponed indefinitely by threads outside the section), and bounded waiting (a thread cannot be skipped forever). A mutex is a binary lock typically owned by the thread that acquired it; it is used to protect a shared data structure such as a shared counter or a list. A counting semaphore holds an integer and supports wait/signal; it is used to represent N identical resources, for example N I/O buffers or a bounded producer-consumer queue. Using a semaphore as a mutex is possible (initial value 1) but mutexes often add ownership and priority inheritance. Race conditions occur when unsynchronised accesses interleave.',
      tags: [TAG, 'OS', 'concurrency'],
    },
    {
      key: 'os_vm',
      subject: 'os',
      topic: 'Memory Management',
      questionText: 'Explain demand paging and a page fault. Describe FIFO, LRU, and Optimal page-replacement algorithms. What is Belady’s anomaly, and which of these algorithms can exhibit it?',
      difficulty: 'hard',
      maxMarks: 12,
      expectedAnswerLength: 180,
      keywords: ['demand paging', 'page fault', 'FIFO', 'LRU', 'optimal', 'Belady', 'thrashing'],
      evaluationRubric: 'Must define demand paging and page fault, summarise all three replacements, and correctly assign Belady’s anomaly to FIFO (not LRU/Optimal). Mention of thrashing is extra credit.',
      referenceAnswer:
        'Demand paging loads a page into memory only when it is referenced. If the page is not resident, a page fault traps to the OS, which finds a free frame or evicts a victim, reads the page from disk, updates the page table, and restarts the instruction. FIFO evicts the oldest loaded page; it is simple but can show Belady’s anomaly, where more frames sometimes cause more faults. LRU evicts the page unused for the longest time; it tracks recency and does not exhibit Belady’s anomaly, but exact LRU is expensive, so clocks and approximations are used. Optimal (Belady’s MIN) evicts the page whose next use is farthest in the future; it is a benchmark, not implementable without knowing the future. Thrashing is excessive paging when the working set does not fit in memory, so the CPU spends most time on faults rather than useful work.',
      tags: [TAG, 'OS', 'virtual-memory'],
    },
    {
      key: 'dbms_acid',
      subject: 'dbms',
      topic: 'Transactions & ACID',
      questionText: 'Explain the ACID properties of a database transaction with a short example for each. Why do we need atomicity and durability together in a banking transfer?',
      difficulty: 'easy',
      maxMarks: 10,
      expectedAnswerLength: 170,
      keywords: ['ACID', 'atomicity', 'consistency', 'isolation', 'durability', 'transaction', 'commit', 'rollback'],
      evaluationRubric: 'All four properties with a concrete example. Banking example should show that a crash must not leave a debit without a credit, and a committed transfer must survive a restart.',
      referenceAnswer:
        'A transaction is a logical unit of work that the DBMS must apply entirely or not at all. Atomicity means all of its writes happen, or none do; a transfer that debits A and credits B must roll back both if it fails midway. Consistency means the database moves from one valid state to another, respecting constraints such as non-negative balances. Isolation means concurrent transactions do not see each other’s uncommitted updates; otherwise two tellers could overdraw the same account. Durability means once the system acknowledges commit, the effects survive crashes, typically via a write-ahead log. In a banking transfer we need atomicity so we never lose money in flight, and durability so a committed transfer is not undone by a power failure. Isolation keeps two overlapping transfers from corrupting balances; consistency enforces the bank’s rules.',
      tags: [TAG, 'DBMS', 'ACID'],
    },
    {
      key: 'dbms_normalization',
      subject: 'dbms',
      topic: 'Normalization',
      questionText: 'What problem does normalisation solve? Define 1NF, 2NF, 3NF, and BCNF with a small example of a violation and how you would fix it. When might a designer intentionally denormalise?',
      difficulty: 'medium',
      maxMarks: 12,
      expectedAnswerLength: 200,
      keywords: ['normalization', '1NF', '2NF', '3NF', 'BCNF', 'functional dependency', 'redundancy', 'update anomaly'],
      evaluationRubric: 'Need the motivation (anomalies/redundancy), correct definitions of the four forms, one worked violation, and a valid denormalisation reason (read performance / reporting).',
      referenceAnswer:
        'Normalisation reduces redundant data and insertion, update, and deletion anomalies by decomposing relations according to functional dependencies, without losing information. 1NF requires atomic values (no repeating groups). 2NF requires 1NF plus no partial dependency of a non-key attribute on part of a composite key. 3NF requires 2NF plus no transitive dependency of a non-key attribute on the key. BCNF is a stricter 3NF: every determinant must be a candidate key. Example: a table Grade(studentId, courseId, studentName, instructor, instructorOffice) with key (studentId, courseId) violates 2NF because studentName depends only on studentId, and may violate 3NF/BCNF if instructorOffice depends on instructor. Fix by splitting into Student, CourseOffering, and Enrolment tables. Designers may denormalise for read-heavy dashboards, adding a stored total to avoid repeated joins, at the cost of extra update logic.',
      tags: [TAG, 'DBMS', 'normalization'],
    },
    {
      key: 'dbms_keys',
      subject: 'dbms',
      topic: 'Keys & Constraints',
      questionText: 'Define super key, candidate key, primary key, and foreign key. How does a foreign key enforce referential integrity? Give one example of ON DELETE CASCADE versus ON DELETE RESTRICT.',
      difficulty: 'easy',
      maxMarks: 8,
      expectedAnswerLength: 140,
      keywords: ['super key', 'candidate key', 'primary key', 'foreign key', 'referential integrity', 'cascade'],
      evaluationRubric: 'Correct four definitions and a clear integrity example. Cascade vs restrict must not be swapped.',
      referenceAnswer:
        'A super key is any set of attributes that uniquely identifies a tuple. A candidate key is a minimal super key (no attribute can be removed without losing uniqueness). The primary key is the candidate key chosen as the main identifier; it should be stable and not null. A foreign key is a set of attributes in one relation that must match a candidate key in another (or be null, if allowed). Referential integrity means you cannot store an order for a customerId that does not exist in Customer. ON DELETE CASCADE means deleting a parent also deletes matching children, for example deleting an order deletes its order-lines. ON DELETE RESTRICT (or NO ACTION) refuses to delete a customer who still has orders, which is safer when children must be archived first.',
      tags: [TAG, 'DBMS', 'keys'],
    },
    {
      key: 'dbms_index',
      subject: 'dbms',
      topic: 'Indexing',
      questionText: 'Why do databases use indexes? Contrast a B+ tree index with a hash index. For which query patterns is each a good fit, and what is the write-cost of maintaining an index?',
      difficulty: 'medium',
      maxMarks: 10,
      expectedAnswerLength: 160,
      keywords: ['index', 'B+ tree', 'hash index', 'range query', 'point lookup', 'secondary index'],
      evaluationRubric: 'Need the purpose (faster lookup at write cost), B+ tree for range/order, hash for equality, and acknowledgement that inserts/updates/deletes must maintain the index.',
      referenceAnswer:
        'An index is an auxiliary structure that locates rows without scanning the whole table. It speeds SELECT and joins on the indexed columns, at the cost of extra storage and slower writes because each insert, update, or delete must also update the index. A B+ tree keeps keys in sorted order in a balanced tree; leaf nodes are linked, so equality lookups, ORDER BY, and range predicates (salary BETWEEN 50 and 80) are efficient. A hash index computes a bucket from the key and is excellent for equality (WHERE email = ...), but it does not support ranges or ordering well. Clustered indexes (where the table is stored in index order) make range scans even faster but make random inserts more expensive. Designers index selective columns used in WHERE and JOIN, not every column.',
      tags: [TAG, 'DBMS', 'indexing'],
    },
    {
      key: 'dbms_joins',
      subject: 'dbms',
      topic: 'Relational Model',
      questionText: 'Explain INNER JOIN, LEFT OUTER JOIN, and FULL OUTER JOIN with a one-line example each (Student and Enrolment). When would a CROSS JOIN be used, and why is it dangerous on large tables?',
      difficulty: 'easy',
      maxMarks: 8,
      expectedAnswerLength: 140,
      keywords: ['inner join', 'left join', 'outer join', 'full join', 'cross join', 'cartesian product'],
      evaluationRubric: 'Correct meaning of inner vs left vs full, a sensible Student/Enrolment example, and CROSS JOIN as cartesian product with a scale warning.',
      referenceAnswer:
        'INNER JOIN returns only matching pairs: students who have at least one enrolment row. LEFT OUTER JOIN returns all students, and enrolment columns are null for students with no course. FULL OUTER JOIN returns all students and all enrolment rows, matching where possible, so you also see orphan enrolments if referential integrity is not enforced. A CROSS JOIN is a cartesian product: every student with every enrolment row, with no matching condition. It is used rarely, for example to generate a calendar of all students × all exam slots. On large tables it explodes in size (n × m rows) and can exhaust memory or time, so it is almost always a mistake when a join predicate was forgotten.',
      tags: [TAG, 'DBMS', 'joins'],
    },
    {
      key: 'dbms_isolation',
      subject: 'dbms',
      topic: 'Transactions & ACID',
      questionText: 'Name the four standard SQL isolation levels. Explain dirty read, non-repeatable read, and phantom read. Which anomalies does READ COMMITTED still allow?',
      difficulty: 'hard',
      maxMarks: 12,
      expectedAnswerLength: 180,
      keywords: ['isolation level', 'read uncommitted', 'read committed', 'repeatable read', 'serializable', 'dirty read', 'phantom'],
      evaluationRubric: 'All four levels, three anomalies defined correctly, and READ COMMITTED allows non-repeatable and phantom reads but not dirty reads.',
      referenceAnswer:
        'The four SQL isolation levels, from weakest to strongest, are READ UNCOMMITTED, READ COMMITTED, REPEATABLE READ, and SERIALIZABLE. A dirty read sees another transaction’s uncommitted write, which may later roll back. A non-repeatable read means a second read of the same row in one transaction sees a different committed value because another transaction updated and committed. A phantom read means a second query with the same predicate sees new rows that another transaction inserted. READ UNCOMMITTED allows dirty reads. READ COMMITTED forbids dirty reads but still allows non-repeatable reads and phantoms. REPEATABLE READ keeps read rows stable; depending on the engine, phantoms may still appear. SERIALIZABLE behaves as if transactions ran one after another, typically using locks or SSI, and prevents all three anomalies at the cost of more aborts or blocking. PostgreSQL’s default is READ COMMITTED.',
      tags: [TAG, 'DBMS', 'isolation'],
    },
    {
      key: 'cn_osi',
      subject: 'cn',
      topic: 'OSI Model',
      questionText: 'List the seven OSI layers from bottom to top. For each layer, give one primary responsibility and one example protocol or device. Why do we teach OSI even though the Internet uses TCP/IP?',
      difficulty: 'medium',
      maxMarks: 12,
      expectedAnswerLength: 190,
      keywords: ['OSI', 'physical', 'data link', 'network', 'transport', 'session', 'presentation', 'application', 'TCP/IP'],
      evaluationRubric: 'All seven layers in order with a correct role each. TCP/IP mapping (OSI is a teaching model; session/presentation collapse into application) expected for full marks.',
      referenceAnswer:
        'Bottom to top: Physical (bits on the wire; cables, voltage, Wi-Fi PHY), Data Link (frames, MAC addressing, switches, Ethernet), Network (routing and logical addressing; IP, routers), Transport (end-to-end process communication; TCP, UDP), Session (dialog control; largely folded into apps), Presentation (syntax, encryption, compression; TLS is often discussed here or in application), Application (user services; HTTP, DNS, SMTP). OSI is a reference model that separates concerns so you can locate a fault: a DHCP issue is not a fibre cut. The real Internet stack is TCP/IP: link, internet, transport, application. Session and presentation do not appear as separate protocols in everyday stacks, but the OSI vocabulary is still used in exams, vendor training, and debugging. A strong answer maps TCP/IP to OSI without claiming the Internet “runs OSI”.',
      tags: [TAG, 'CN', 'OSI'],
    },
    {
      key: 'cn_tcpudp',
      subject: 'cn',
      topic: 'Transport Layer Protocols',
      questionText: 'Differentiate TCP and UDP. Discuss connection setup, reliability, ordering, congestion control, and header overhead. Give two realistic applications for each protocol and justify the choice.',
      difficulty: 'medium',
      maxMarks: 10,
      expectedAnswerLength: 170,
      keywords: ['TCP', 'UDP', 'three-way handshake', 'reliability', 'congestion control', 'streaming', 'DNS'],
      evaluationRubric: 'Must contrast connection-oriented vs connectionless, reliability/ordering, and congestion. Application examples must match (HTTP/file vs DNS/video/VoIP).',
      referenceAnswer:
        'TCP is connection-oriented: a three-way handshake establishes a session, then data is sequenced, acknowledged, and retransmitted on loss. It provides ordered byte-stream delivery and congestion control so senders slow down when the network is busy. The cost is latency and header overhead. UDP is connectionless: the application sends datagrams with no handshake, no guarantee of delivery or order, and no built-in congestion control. That makes UDP low-latency and simple. TCP fits web pages, email, file transfer, and SSH, where correctness matters more than a few extra round trips. UDP fits DNS queries, video/voice (where a late packet is useless), and some games; the application may add its own retransmission (as QUIC does over UDP). Choosing TCP for live voice usually adds delay; choosing UDP for a bank transfer would require rebuilding reliability in user space.',
      tags: [TAG, 'CN', 'TCP-UDP'],
    },
    {
      key: 'cn_ip',
      subject: 'cn',
      topic: 'IP Addressing',
      questionText: 'Explain IPv4 addressing, subnet masks, and why we need CIDR. What problem does NAT solve, and what is one limitation of NAT for incoming connections? Contrast IPv4 exhaustion with IPv6 at a high level.',
      difficulty: 'medium',
      maxMarks: 10,
      expectedAnswerLength: 170,
      keywords: ['IPv4', 'subnet mask', 'CIDR', 'NAT', 'IPv6', 'private address'],
      evaluationRubric: 'Need host vs network bits, CIDR as flexible prefixes, NAT conserving public IPv4 with the inbound-connection limitation, and IPv6 as a larger address space.',
      referenceAnswer:
        'An IPv4 address is 32 bits, usually written as four decimals. A subnet mask (or prefix length) splits network bits from host bits so many hosts can share a routing prefix. Classful networks wasted space; CIDR lets prefixes be any length (for example /24 or /20) so ISPs allocate more tightly. NAT maps many private addresses (10/8, 172.16/12, 192.168/16) onto fewer public addresses, which delayed IPv4 exhaustion. A limitation is that hosts behind NAT are not globally reachable: inbound connections need port forwarding or hole-punching, which complicates peer-to-peer and some servers. IPv6 uses 128-bit addresses, making NAT unnecessary for address shortage. A complete answer may mention that NAT also hides internal topology, which is sometimes treated as a crude security side-effect but is not a firewall by itself.',
      tags: [TAG, 'CN', 'IP'],
    },
    {
      key: 'cn_dns',
      subject: 'cn',
      topic: 'Application Layer',
      questionText: 'Describe how a recursive DNS resolver looks up www.example.com, starting from the root. Mention root, TLD, and authoritative servers, and the role of caching. What is the difference between an A record and a CNAME?',
      difficulty: 'medium',
      maxMarks: 10,
      expectedAnswerLength: 160,
      keywords: ['DNS', 'resolver', 'root', 'TLD', 'authoritative', 'cache', 'A record', 'CNAME'],
      evaluationRubric: 'Correct lookup chain and caching. A vs CNAME must not be reversed (A maps to IPv4; CNAME aliases another name).',
      referenceAnswer:
        'The stub resolver on the client asks a recursive resolver (often the ISP or 8.8.8.8). If the answer is not cached, the recursive resolver queries a root server, which does not know the IP but refers it to the .com TLD servers. The TLD refers it to the authoritative name servers for example.com. Those servers return the record for www.example.com. Each referral and final answer can be cached for its TTL so later lookups are faster and load on the root is reduced. An A record maps a name to an IPv4 address. A CNAME maps a name to another name, which must then be resolved further. DNS is a distributed hierarchical database; poisoning or spoofing is a security concern, which DNSSEC aims to mitigate.',
      tags: [TAG, 'CN', 'DNS'],
    },
    {
      key: 'cn_http',
      subject: 'cn',
      topic: 'Application Layer',
      questionText: 'Differentiate HTTP and HTTPS. What does TLS provide, and where does it sit relative to TCP? Explain why a public Wi-Fi user should prefer HTTPS, and what a certificate is used for.',
      difficulty: 'easy',
      maxMarks: 8,
      expectedAnswerLength: 140,
      keywords: ['HTTP', 'HTTPS', 'TLS', 'certificate', 'encryption', 'authentication'],
      evaluationRubric: 'HTTPS = HTTP over TLS; confidentiality and server authentication; certificate binds a public key to a domain; HTTP on public Wi-Fi can be read or altered.',
      referenceAnswer:
        'HTTP is a request-response protocol for web resources and is not encrypted. HTTPS is HTTP over TLS (historically SSL). TLS runs above TCP and provides confidentiality (encryption), integrity (detect tampering), and authentication of the server via an X.509 certificate issued by a trusted CA, binding a public key to a domain name. The client verifies the certificate, then the two sides agree on session keys. On public Wi-Fi, plain HTTP can be sniffed or modified by anyone on the same network; HTTPS stops casual eavesdropping and many injection attacks. HTTPS does not hide the destination domain from the network in all cases (SNI, DNS), and a compromised CA or ignored browser warnings still break the model. HTTP status codes and methods are the same; only the transport security changes.',
      tags: [TAG, 'CN', 'HTTP'],
    },
    {
      key: 'cn_congestion',
      subject: 'cn',
      topic: 'Transport Layer Protocols',
      questionText: 'What is network congestion? Explain TCP slow start and AIMD (additive increase, multiplicative decrease). How is congestion different from flow control?',
      difficulty: 'hard',
      maxMarks: 10,
      expectedAnswerLength: 160,
      keywords: ['congestion', 'slow start', 'AIMD', 'cwnd', 'flow control', 'packet loss'],
      evaluationRubric: 'Congestion is a network-wide overload; flow control is receiver speed. Slow start grows cwnd exponentially; AIMD probes linearly and cuts on loss. Do not swap the two controls.',
      referenceAnswer:
        'Congestion happens when routers or links have more traffic than they can forward, causing queues, delay, and packet loss. TCP treats loss (or delay signals) as a congestion hint. Slow start grows the congestion window (cwnd) exponentially until a threshold, so a new connection quickly finds spare capacity. Then congestion avoidance uses AIMD: add a little to cwnd each round trip if data is delivered, and multiply cwnd down (typically halve) on loss, which is fair and stable among competing TCPs. Flow control is different: the receiver advertises a window so the sender does not overrun the receiver’s buffer. You can have a fast network and a slow receiver (flow control binds) or a fast receiver and a busy path (congestion control binds). Modern variants (CUBIC, BBR) change the exact growth rule but still aim to share the bottleneck.',
      tags: [TAG, 'CN', 'congestion'],
    },
    {
      key: 'oop_pillars',
      subject: 'oop',
      topic: 'OOP Concepts',
      questionText: 'Explain the four pillars of object-oriented programming — encapsulation, abstraction, inheritance, and polymorphism — with a short programming example for each. Why does encapsulation matter in a large team codebase?',
      difficulty: 'easy',
      maxMarks: 10,
      expectedAnswerLength: 180,
      keywords: ['encapsulation', 'abstraction', 'inheritance', 'polymorphism', 'class', 'interface'],
      evaluationRubric: 'All four pillars with examples. Encapsulation should mention hiding internals and a stable public API, not only “private keyword”.',
      referenceAnswer:
        'Encapsulation bundles data with the methods that operate on it and hides representation behind a public API; a BankAccount class keeps balance private and exposes deposit/withdraw so callers cannot set a negative balance directly. Abstraction shows the essential interface and hides details; a PaymentProcessor interface lets the rest of the app charge a card without knowing Stripe versus Razorpay internals. Inheritance lets a specialised class reuse and extend a base; SavingsAccount can inherit BankAccount and add interest. Polymorphism lets one interface have many implementations: a list of Shape objects can each implement area(), and the caller does not switch on circles vs rectangles. In a large team, encapsulation matters because other developers can change private fields or algorithms without breaking every caller, as long as the public contract stays stable. Overusing inheritance for code reuse is a common mistake; composition is often safer.',
      tags: [TAG, 'OOP', 'pillars'],
    },
    {
      key: 'oop_override',
      subject: 'oop',
      topic: 'Inheritance & Polymorphism',
      questionText: 'Differentiate method overloading and method overriding. Include compile-time vs run-time binding, and a small example. What is the Liskov Substitution Principle in one or two sentences, related to overriding?',
      difficulty: 'medium',
      maxMarks: 10,
      expectedAnswerLength: 160,
      keywords: ['overloading', 'overriding', 'compile-time', 'runtime', 'virtual', 'Liskov'],
      evaluationRubric: 'Overloading = same name, different parameters, static binding. Overriding = same signature in subclass, dynamic dispatch. LSP: subclass must honour the base contract.',
      referenceAnswer:
        'Overloading means multiple methods in the same class (or a related class) share a name but differ in parameter type or count, for example print(int) and print(String). The compiler picks the method from the call signature (compile-time / static polymorphism). Overriding means a subclass supplies a new implementation of a method already declared in a superclass with the same signature, for example Dog.speak() overriding Animal.speak(). The method that runs is chosen from the actual object type at run time (dynamic dispatch). The Liskov Substitution Principle says a subclass instance should be usable anywhere a superclass is expected without breaking callers’ assumptions: overriding must not strengthen preconditions or weaken postconditions. A Square that inherits Rectangle and silently ignores setWidth is a classic LSP violation.',
      tags: [TAG, 'OOP', 'polymorphism'],
    },
    {
      key: 'oop_abstract',
      subject: 'oop',
      topic: 'OOP Concepts',
      questionText: 'Compare an abstract class and an interface (as used in Java or similar languages). When would you choose each? Mention default methods or multiple inheritance only if you are precise.',
      difficulty: 'medium',
      maxMarks: 10,
      expectedAnswerLength: 150,
      keywords: ['abstract class', 'interface', 'multiple inheritance', 'implements', 'extends'],
      evaluationRubric: 'Abstract class can hold state and partial implementation; interface is a capability contract, and a class may implement many. Choice should match “is-a with shared code” vs “can-do”.',
      referenceAnswer:
        'An abstract class can declare abstract methods and also fields, constructors, and concrete methods. It is used when subclasses share a genuine is-a relationship and some implementation, for example an abstract Employee with a common payroll helper and abstract computeBonus(). A class can extend only one abstract class in Java. An interface declares a capability (Payable, Comparable) without dictating the inheritance tree; a class may implement many interfaces. Interfaces traditionally had no instance state; modern Java default methods blur the line slightly but should not turn an interface into a mini abstract class. Choose an abstract class for shared code and a single backbone hierarchy. Choose interfaces to add roles (Serializable, Iterable) without forcing a parent class. If two types only share a method name, an interface is usually cleaner than a dummy abstract parent.',
      tags: [TAG, 'OOP', 'interfaces'],
    },
    {
      key: 'oop_solid',
      subject: 'oop',
      topic: 'Design Principles',
      questionText: 'Explain the SOLID principles. Give a concrete “before vs after” for Single Responsibility and Open/Closed. You may summarise the remaining three more briefly.',
      difficulty: 'hard',
      maxMarks: 12,
      expectedAnswerLength: 200,
      keywords: ['SOLID', 'SRP', 'OCP', 'LSP', 'ISP', 'DIP'],
      evaluationRubric: 'Name all five. SRP and OCP need a before/after. Remaining three can be shorter but must be correct (LSP, ISP, DIP).',
      referenceAnswer:
        'SOLID is a set of design guidelines. Single Responsibility (SRP): a class should have one reason to change. Before: an Order class that also sends email and writes SQL. After: Order, OrderRepository, and EmailNotifier. Open/Closed (OCP): open for extension, closed for modification. Before: a tax() method with a growing switch on country. After: a TaxStrategy interface with IndiaTax and USTax implementations selected by configuration. Liskov Substitution: subtypes must honour the parent contract. Interface Segregation: many small interfaces beat one fat interface that forces unused methods. Dependency Inversion: high-level policy should depend on abstractions, not on a concrete MySQL class; inject a Repository interface. The point is not to create a class per line of code, but to localise change and make testing possible. Name-dropping SOLID without an example should not receive full marks.',
      tags: [TAG, 'OOP', 'SOLID'],
    },
    {
      key: 'oop_composition',
      subject: 'oop',
      topic: 'Design Principles',
      questionText: 'Compare composition and inheritance for code reuse. Why do many design guides say “favour composition over inheritance”? Illustrate with a simple example (for example, a Car that has an Engine vs a Car that extends Engine).',
      difficulty: 'medium',
      maxMarks: 8,
      expectedAnswerLength: 140,
      keywords: ['composition', 'inheritance', 'has-a', 'is-a', 'reuse'],
      evaluationRubric: 'Has-a vs is-a, a valid example, and a reason: inheritance couples hierarchies and is harder to change; composition can swap engines.',
      referenceAnswer:
        'Inheritance is an is-a relationship: a SavingsAccount is a BankAccount and reuses its fields and methods. Composition is a has-a relationship: a Car has an Engine, and it calls engine.start() rather than becoming an Engine. Favouring composition means you plug in behaviour instead of extending a superclass every time you need reuse. If Car extends Engine, you cannot easily give the car a different engine type without rewriting the hierarchy, and Car inherits methods that do not make sense for a vehicle. If Car holds an Engine interface, you can inject a PetrolEngine or ElectricEngine at runtime. Inheritance is still right when the subtype truly is a special case of the parent and LSP holds. A common failure is inheriting only to steal a utility method; a helper object or module is clearer.',
      tags: [TAG, 'OOP', 'composition'],
    },
    {
      key: 'oop_exceptions',
      subject: 'oop',
      topic: 'OOP Concepts',
      questionText: 'Explain exception handling. What is the difference between checking a return code and throwing an exception? Describe try, catch, and finally (or equivalent). When should you catch an exception versus let it propagate?',
      difficulty: 'easy',
      maxMarks: 8,
      expectedAnswerLength: 140,
      keywords: ['exception', 'try', 'catch', 'finally', 'checked', 'unchecked', 'propagate'],
      evaluationRubric: 'Need try/catch/finally roles, why exceptions separate happy path from errors, and a rule: catch only if you can handle or add context; otherwise propagate.',
      referenceAnswer:
        'An exception signals that a method cannot complete its contract, such as a missing file or a parse error. Unlike a special return code, it does not have to be ignored by accident: it unwinds the stack until a handler is found, which keeps the happy path uncluttered. try marks the risky block, catch handles specific types, and finally (or a defer/using construct) always runs to close files or connections. Catch an exception when this layer can recover (retry, fallback, user message) or when you must translate it into a domain error. Let it propagate when the current method has no useful policy; otherwise you hide bugs with empty catch blocks. Logging and rethrowing is acceptable if you add context. Do not use exceptions for ordinary control flow such as “item not in list” in a tight loop.',
      tags: [TAG, 'OOP', 'exceptions'],
    },
    {
      key: 'cloud_models',
      subject: 'cloud',
      topic: 'Cloud Models',
      questionText: 'Explain IaaS, PaaS, and SaaS with one example each. Who manages the operating system in each model? When would a startup choose PaaS over IaaS for a first product?',
      difficulty: 'medium',
      maxMarks: 10,
      expectedAnswerLength: 160,
      keywords: ['IaaS', 'PaaS', 'SaaS', 'shared responsibility', 'AWS', 'Heroku', 'Salesforce'],
      evaluationRubric: 'Correct three models, OS responsibility (customer on IaaS, provider on PaaS/SaaS), and a sensible PaaS reason (speed, less ops).',
      referenceAnswer:
        'IaaS (Infrastructure as a Service) rents virtual machines, storage, and networks; examples are Amazon EC2 or Google Compute Engine. The customer manages the guest OS, runtime, and application. PaaS (Platform as a Service) provides a runtime and deployment pipeline; examples are Heroku, Cloud Foundry, or Google App Engine. The provider manages the OS and often the language runtime; the customer ships code. SaaS (Software as a Service) is a finished application consumed through a browser or API, such as Gmail or Salesforce; the customer only configures users and data. A startup often chooses PaaS for a first product to avoid hiring an operations team, to get HTTPS, scaling, and deploys quickly, and to pay for usage. They might move to IaaS later for custom networking, GPUs, or cost control at scale. Shared-responsibility still applies: even on SaaS, the customer is responsible for access control and the data they store.',
      tags: [TAG, 'cloud', 'IaaS-PaaS-SaaS'],
    },
  ];
}

function buildTest({ title, description, duration, items, createdBy, vendorId }) {
  return {
    title,
    description,
    vendorId,
    createdBy,
    type: 'theory',
    source: 'vendor',
    duration,
    questions: items.map((q, i) => ({
      type: 'theory',
      questionId: q._id,
      questionType: 'TheoryQuestion',
      points: q.maxMarks || 10,
      order: i + 1,
    })),
    englishSections: [],
    isActive: true,
    settings: {
      allowMultipleAttempts: false,
      autoSubmitAtWindowEnd: true,
      showResults: true,
      resultDisplay: 'detailed',
      shuffleQuestions: false,
      practiceMode: false,
    },
  };
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const admin = await User.findOne({ email: SOURCE_EMAIL, role: 'vendor_admin', isActive: true });
  if (!admin?.vendorId) throw new Error(`Vendor admin not found: ${SOURCE_EMAIL}`);
  const vendorId = admin.vendorId;
  const createdBy = admin._id;

  const existing = await Test.find({ vendorId, title: { $in: TEST_SPECS } }).select('title').lean();
  if (existing.length) {
    throw new Error(`Demo tests already exist: ${existing.map((t) => t.title).join('; ')}`);
  }

  console.log('Ensuring subjects and topics...');
  const subjectDocs = {};
  for (const [key, meta] of Object.entries(SUBJECTS)) {
    subjectDocs[key] = await ensureSubject(vendorId, createdBy, meta);
  }

  const topicNames = {};
  for (const def of questionDefs()) {
    const sk = def.subject;
    if (!topicNames[sk]) topicNames[sk] = new Set();
    topicNames[sk].add(def.topic);
  }
  const topicDocs = {};
  for (const [sk, names] of Object.entries(topicNames)) {
    topicDocs[sk] = {};
    for (const name of names) {
      topicDocs[sk][name] = await ensureTopic(vendorId, createdBy, subjectDocs[sk]._id, name);
    }
  }

  const defs = questionDefs();
  const docs = defs.map((def) => {
    const { key, subject, topic, ...rest } = def;
    return {
      ...rest,
      subjectId: subjectDocs[subject]._id,
      topicId: topicDocs[subject][topic]._id,
      vendorId,
      createdBy,
      isGlobal: false,
      evaluationConfig: {
        similarityWeight: 0.45,
        conceptWeight: 0.35,
        depthWeight: 0.2,
        strictness: 'moderate',
      },
    };
  });

  console.log(`Inserting ${docs.length} theory questions...`);
  const inserted = await TheoryQuestion.insertMany(docs);
  const Q = byKey(inserted, defs);

  const tests = [
    buildTest({
      title: TEST_SPECS[0],
      description:
        'Campus-hiring theory paper covering Operating Systems, DBMS, Computer Networks, OOP, and Cloud. Written answers are AI-evaluated against model solutions and keywords.',
      duration: 90,
      createdBy,
      vendorId,
      items: pick(Q, [
        'os_deadlock',
        'os_scheduling',
        'dbms_acid',
        'dbms_normalization',
        'cn_osi',
        'cn_tcpudp',
        'oop_pillars',
        'cloud_models',
      ]),
    }),
    buildTest({
      title: TEST_SPECS[1],
      description:
        'Focused Operating Systems assessment: processes and threads, CPU scheduling, deadlock, paging, synchronisation, and demand paging.',
      duration: 60,
      createdBy,
      vendorId,
      items: pick(Q, [
        'os_process_thread',
        'os_scheduling',
        'os_deadlock',
        'os_paging',
        'os_sync',
        'os_vm',
      ]),
    }),
    buildTest({
      title: TEST_SPECS[2],
      description:
        'Relational database theory: ACID, normalisation, keys, indexing, joins, and isolation levels. Suitable for a 60-minute core-CS round.',
      duration: 60,
      createdBy,
      vendorId,
      items: pick(Q, [
        'dbms_acid',
        'dbms_normalization',
        'dbms_keys',
        'dbms_index',
        'dbms_joins',
        'dbms_isolation',
      ]),
    }),
    buildTest({
      title: TEST_SPECS[3],
      description:
        'Computer Networks theory paper: OSI model, TCP vs UDP, IP and NAT, DNS, HTTPS, and TCP congestion control.',
      duration: 60,
      createdBy,
      vendorId,
      items: pick(Q, [
        'cn_osi',
        'cn_tcpudp',
        'cn_ip',
        'cn_dns',
        'cn_http',
        'cn_congestion',
      ]),
    }),
    buildTest({
      title: TEST_SPECS[4],
      description:
        'Object-oriented design theory: four pillars, overloading vs overriding, abstract types, SOLID, composition, and exception handling.',
      duration: 50,
      createdBy,
      vendorId,
      items: pick(Q, [
        'oop_pillars',
        'oop_override',
        'oop_abstract',
        'oop_solid',
        'oop_composition',
        'oop_exceptions',
      ]),
    }),
  ];

  console.log('Creating tests...');
  const created = await Test.insertMany(tests);
  await Vendor.updateOne({ _id: vendorId }, { $inc: { 'stats.totalTests': created.length } });

  const verify = await Test.find({ vendorId, title: { $in: TEST_SPECS } }).lean();
  if (verify.length !== 5) throw new Error(`Expected 5 tests, found ${verify.length}`);

  for (const t of verify) {
    if (t.type !== 'theory') throw new Error(`${t.title} has type ${t.type}`);
    if (!t.questions?.length) throw new Error(`${t.title} has no questions`);
    for (const q of t.questions) {
      const doc = await TheoryQuestion.findById(q.questionId).select('vendorId subjectId referenceAnswer').lean();
      if (!doc) throw new Error(`${t.title}: missing question ${q.questionId}`);
      if (String(doc.vendorId) !== String(vendorId)) throw new Error(`${t.title}: question not owned by sales vendor`);
      if (!doc.referenceAnswer) throw new Error(`${t.title}: empty reference answer`);
      if (!doc.subjectId) throw new Error(`${t.title}: missing subject`);
    }
  }

  console.log(JSON.stringify({
    ok: true,
    tests: verify.map((t) => ({
      title: t.title,
      duration: t.duration,
      questions: t.questions.length,
      totalMarks: t.questions.reduce((s, q) => s + (q.points || 0), 0),
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
