//
//  Created by Mingliang Chen on 18/3/9.
//  illuspas[a]gmail.com
//  Copyright (c) 2018 Nodemedia. All rights reserved.
//
const Logger = require('./node_core_logger');

const EventEmitter = require('events');
const { spawn } = require('child_process');
const dateFormat = require('dateformat');
const mkdirp = require('mkdirp');
const fs = require('fs');

class NodeTransSession extends EventEmitter {
  constructor(conf) {
    super();
    this.conf = conf;
  }

  run() {
    let vc = this.conf.vc || 'copy';
    let ac = this.conf.ac || 'copy';
    let inPath = 'rtmp://127.0.0.1:' + this.conf.rtmpPort + this.conf.streamPath;
    let ouPath = `${this.conf.mediaroot}/${this.conf.streamApp}/${this.conf.streamName}`;
    let mapStr = '';
    let src = inPath;

    if (this.conf.detect) {
      inPath = '-'
    }
    if (this.conf.rtmp && this.conf.rtmpApp) {
      if (this.conf.rtmpApp === this.conf.streamApp) {
        Logger.error('[Transmuxing RTMP] Cannot output to the same app.');
      } else {
        let rtmpOutput = `rtmp://127.0.0.1:${this.conf.rtmpPort}/${this.conf.rtmpApp}/${this.conf.streamName}`;
        if (this.conf.detect) {
            mapStr += `${rtmpOutput}`
        } else {
            mapStr += `[f=flv]${rtmpOutput}|`;
        }
        Logger.log('[Transmuxing RTMP] ' + this.conf.streamPath + ' to ' + rtmpOutput);
      }
    }
    if (this.conf.mp4) {
      this.conf.mp4Flags = this.conf.mp4Flags ? this.conf.mp4Flags : '';
      let mp4FileName = dateFormat('yyyy-mm-dd-HH-MM') + '.mp4';
      let mapMp4 = `${this.conf.mp4Flags}${ouPath}/${mp4FileName}|`;
      mapStr += mapMp4;
      Logger.log('[Transmuxing MP4] ' + this.conf.streamPath + ' to ' + ouPath + '/' + mp4FileName);
    }
    if (this.conf.hls) {
      this.conf.hlsFlags = this.conf.hlsFlags ? this.conf.hlsFlags : '';
      let hlsFileName = 'index.m3u8';
      let mapHls = `${this.conf.hlsFlags}${ouPath}/${hlsFileName}|`;
      mapStr += mapHls;
      Logger.log('[Transmuxing HLS] ' + this.conf.streamPath + ' to ' + ouPath + '/' + hlsFileName);
    }
    if (this.conf.dash) {
      this.conf.dashFlags = this.conf.dashFlags ? this.conf.dashFlags : '';
      let dashFileName = 'index.mpd';
      let mapDash = `${this.conf.dashFlags}${ouPath}/${dashFileName}`;
      mapStr += mapDash;
      Logger.log('[Transmuxing DASH] ' + this.conf.streamPath + ' to ' + ouPath + '/' + dashFileName);
    }
    mkdirp.sync(ouPath);
    let argv;
    if (this.conf.detect) {
        argv = ['-y',
        '-f', 'rawvideo',
        '-vcodec','rawvideo',
        '-s', '640x360',
        '-pix_fmt', 'bgr24',
        '-r', '30',
        '-i', '-',
        '-an',
        '-vcodec', 'libx264',
        '-c:a', 'aac',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-f', 'flv',
        '-map', '0:a?', '-map', '0:v?',
        mapStr ]
    } else {
        argv = ['-y', '-fflags', 'nobuffer', '-i', inPath]
        if (this.conf.scale) {
            Array.prototype.push.apply(argv, ['-vf', `scale=${this.conf.scale}`]);
            Array.prototype.push.apply(argv, ['-vcodec', 'libx264']);
        } else {
            Array.prototype.push.apply(argv, ['-c:v', vc]);
            Array.prototype.push.apply(argv, this.conf.vcParam);
        }
        Array.prototype.push.apply(argv, ['-c:a', ac]);
        Array.prototype.push.apply(argv, this.conf.acParam);
        Array.prototype.push.apply(argv, ['-f', 'tee']);
        Array.prototype.push.apply(argv, ['-map', '0:a?', '-map', '0:v?', mapStr]);
        argv = argv.filter((n) => { return n }); //去空
    }
    Logger.log(`ffmpeg args: ${argv.join(' ')}`)
    this.ffmpeg_exec = spawn(this.conf.ffmpeg, argv);
    if (this.conf.detect) {
        this.detect_exec = spawn('node', [`${__dirname}/lib/face-detection`, src])
        let pipe = this.detect_exec.stdio[3];
        this.detect_exec.stdout.on('data', data => {
            // console.log(data)
            this.ffmpeg_exec.stdin.write(data)
        })
        this.detect_exec.stderr.pipe(process.stderr);
    }
    // this.ffmpeg_exec.stdout.pipe(process.stdout)
    // this.ffmpeg_exec.stderr.pipe(process.stderr)

    this.ffmpeg_exec.stdout.on('data', (data) => {
      Logger.ffdebug(`FF输出：${data}`);
    });

    this.ffmpeg_exec.stderr.on('data', (data) => {
      Logger.ffdebug(`FF输出：${data}`);
    });

    this.ffmpeg_exec.on('close', (code) => {
      Logger.log('[Transmuxing end] ' + this.conf.streamPath);
      if (this.conf.detect) {
          this.detect_exec.kill('SIGINT')
      }
      this.emit('end');
      fs.readdir(ouPath, function (err, files) {
        if (!err) {
          files.forEach((filename) => {
            if (filename.endsWith('.ts')
              || filename.endsWith('.m3u8')
              || filename.endsWith('.mpd')
              || filename.endsWith('.m4s')
              || filename.endsWith('.tmp')) {
              fs.unlinkSync(ouPath + '/' + filename);
            }
          })
        }
      });
    });
  }

  end() {
    // this.ffmpeg_exec.kill();
  }
}

module.exports = NodeTransSession;
