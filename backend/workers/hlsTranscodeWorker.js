const Queue = require('bull');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const CourseLecture = require('../models/CourseLecture');
const { downloadFromR2, uploadToR2, deletePrefixFromR2 } = require('../utils/r2Storage');
const { getBullQueueOptions } = require('../config/redis');
const { HLS_TRANSCODE } = require('../config/bullQueueNames');

const hlsQueue = new Queue(HLS_TRANSCODE, getBullQueueOptions());

hlsQueue.on('ready', () => {
  console.log('✅ Redis: HLS transcode queue ready.');
});

let lastErrorLog = 0;
hlsQueue.on('error', (err) => {
  const now = Date.now();
  if (now - lastErrorLog > 60000) {
    lastErrorLog = now;
    console.error('❌ HLS queue Redis error:', err.message || err);
  }
});

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    proc.on('error', (err) => {
      reject(new Error(`ffmpeg spawn failed: ${err.message}. Is ffmpeg installed?`));
    });
    proc.on('close', (code) => {
      if (code === 0) resolve(stderr);
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-2000)}`));
    });
  });
}

async function probeDurationSec(filePath) {
  return new Promise((resolve) => {
    const proc = spawn(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', filePath],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let out = '';
    proc.stdout.on('data', (d) => {
      out += d.toString();
    });
    proc.on('close', () => {
      const n = parseFloat(out.trim());
      resolve(Number.isFinite(n) ? Math.round(n) : 0);
    });
    proc.on('error', () => resolve(0));
  });
}

async function uploadDirToR2(localDir, keyPrefix) {
  const entries = await fsp.readdir(localDir);
  for (const name of entries) {
    const full = path.join(localDir, name);
    const stat = await fsp.stat(full);
    if (!stat.isFile()) continue;
    const buf = await fsp.readFile(full);
    await uploadToR2(buf, `${keyPrefix}/${name}`, name);
  }
}

hlsQueue.process(1, async (job) => {
  const { lectureId } = job.data;
  console.log(`🎬 HLS transcode start lecture=${lectureId}`);

  const lecture = await CourseLecture.findById(lectureId);
  if (!lecture || !lecture.video?.originalKey) {
    throw new Error('Lecture or original video missing');
  }

  lecture.video.status = 'processing';
  lecture.video.errorMessage = null;
  await lecture.save();

  const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'hls-'));
  const ext = path.extname(lecture.video.originalKey) || '.mp4';
  const inputPath = path.join(tmpRoot, `input${ext}`);
  const outDir = path.join(tmpRoot, 'out');
  await fsp.mkdir(outDir);

  try {
    const buf = await downloadFromR2(lecture.video.originalKey);
    await fsp.writeFile(inputPath, buf);

    const durationSec = await probeDurationSec(inputPath);

    // Single-rendition HLS for v1 (reliable + lighter). Multi-ladder can be added later.
    const masterName = 'master.m3u8';
    await runFfmpeg([
      '-y',
      '-i',
      inputPath,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-ac',
      '2',
      '-f',
      'hls',
      '-hls_time',
      '6',
      '-hls_playlist_type',
      'vod',
      '-hls_segment_filename',
      path.join(outDir, 'seg_%03d.ts'),
      path.join(outDir, masterName),
    ]);

    const hlsPrefix = `courses/${lecture.courseId}/lectures/${lecture._id}/hls`;
    await deletePrefixFromR2(hlsPrefix);
    await uploadDirToR2(outDir, hlsPrefix);

    lecture.video.hlsPrefix = hlsPrefix;
    lecture.video.durationSec = durationSec || lecture.video.durationSec || 0;
    lecture.video.status = 'ready';
    lecture.video.errorMessage = null;
    await lecture.save();

    console.log(`✅ HLS ready lecture=${lectureId} duration=${lecture.video.durationSec}s`);
    return { ok: true, hlsPrefix, durationSec: lecture.video.durationSec };
  } catch (err) {
    lecture.video.status = 'failed';
    lecture.video.errorMessage = err.message || String(err);
    await lecture.save();
    console.error(`❌ HLS failed lecture=${lectureId}:`, err.message || err);
    throw err;
  } finally {
    try {
      await fsp.rm(tmpRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

async function enqueueHlsTranscode(lectureId) {
  return hlsQueue.add(
    { lectureId: String(lectureId) },
    {
      attempts: 2,
      backoff: { type: 'exponential', delay: 10000 },
      removeOnComplete: true,
    }
  );
}

async function closeHlsQueue() {
  await hlsQueue.close();
}

module.exports = {
  hlsQueue,
  enqueueHlsTranscode,
  closeHlsQueue,
};

// Keep process alive when run standalone: node workers/hlsTranscodeWorker.js
if (require.main === module) {
  console.log('HLS transcode worker running (standalone)');
}
