// V2GIF Converter - FFmpeg.wasmによる動画→GIF変換モジュール

class V2GIFConverter {
  constructor() {
    this.ffmpeg = null;
    this.ffmpegError = null;
    this.onLog = null;
    this.onProgress = null;
  }

  async init() {
    const { createFFmpeg } = FFmpeg;

    this.ffmpeg = createFFmpeg({
      mainName: 'main',
      corePath: 'https://unpkg.com/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.js',
      log: true
    });

    this.ffmpeg.setLogger(({ type, message }) => {
      if (message) {
        if (this.onLog) this.onLog(message);
        if (message.includes('Out of memory') ||
            message.includes('Error while filtering') ||
            message.includes('Conversion failed') ||
            message.includes('failed to execute')) {
          this.ffmpegError = message;
        }
      }
    });

    this.ffmpeg.setProgress(({ ratio }) => {
      if (this.onProgress) this.onProgress(ratio);
    });

    await this.ffmpeg.load();
  }

  async convert(videoData, params = {}) {
    await this.init();
    this.ffmpegError = null;

    try {
      const fps = params.fps || '10';
      const width = params.width || '600';
      const height = params.height || '-1';
      const startTime = parseFloat(params.startTime) || 0;
      const endTime = params.endTime ? parseFloat(params.endTime) : null;
      const scale = `${width}:${height}`;

      // 入力ファイル書き込み
      this.ffmpeg.FS('writeFile', 'input.mp4', new Uint8Array(videoData));

      // FFmpegコマンド構築
      const ffmpegArgs = [];

      if (startTime > 0) {
        ffmpegArgs.push('-ss', startTime.toString());
      }

      ffmpegArgs.push('-i', 'input.mp4');

      if (endTime !== null && endTime > startTime) {
        ffmpegArgs.push('-t', (endTime - startTime).toString());
      }

      // 切り出しフィルター
      let cropFilter = '';
      if (params.cropX != null && params.cropY != null && params.cropWidth && params.cropHeight) {
        cropFilter = `crop=${params.cropWidth}:${params.cropHeight}:${params.cropX}:${params.cropY},`;
      }

      ffmpegArgs.push(
        '-filter_complex',
        `[0:v]${cropFilter}fps=${fps},scale=${scale}:flags=lanczos,split[s0][s1];` +
        `[s0]palettegen[p];` +
        `[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
        '-y', 'output.gif'
      );

      await this.ffmpeg.run(...ffmpegArgs);

      if (this.ffmpegError) {
        throw new Error(this.ffmpegError);
      }

      // 出力チェック
      const files = this.ffmpeg.FS('readdir', '/');
      if (!files.includes('output.gif')) {
        throw new Error('GIF file was not created');
      }

      const outputStat = this.ffmpeg.FS('stat', '/output.gif');
      if (outputStat.size === 0) {
        throw new Error('GIF file is empty');
      }

      // 結果読み込み
      const data = this.ffmpeg.FS('readFile', 'output.gif');
      const gifBlob = new Blob([data.buffer], { type: 'image/gif' });

      return gifBlob;

    } finally {
      // クリーンアップ
      try {
        this.ffmpeg.FS('unlink', 'input.mp4');
        this.ffmpeg.FS('unlink', 'output.gif');
      } catch (e) { /* ignore */ }

      if (this.ffmpeg && this.ffmpeg.isLoaded()) {
        this.ffmpeg.exit();
        this.ffmpeg = null;
      }
    }
  }
}
