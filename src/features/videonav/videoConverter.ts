/**
 * src/features/videonav/videoConverter.ts
 *
 * Client-side video converter from Apple QuickTime (.mov) to H.264/MP4.
 * Employs OffscreenCanvas and MediaRecorder with MP4/WebM MIME detection
 * to convert and export playable video in real time.
 */

export interface ConversionProgress {
  status: 'idle' | 'loading' | 'converting' | 'completed' | 'error';
  progressPercent: number;
  currentTimeSec: number;
  durationSec: number;
  outputBlob?: Blob;
  outputUrl?: string;
  errorMessage?: string;
}

export type ConversionListener = (progress: ConversionProgress) => void;

export class VideoConverter {
  /**
   * Converts a .mov video file to .mp4 using browser MediaRecorder & Canvas pipeline.
   */
  public static async convertMovToMp4(
    file: File,
    onProgress?: ConversionListener
  ): Promise<{ blob: Blob; url: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
      onProgress?.({
        status: 'loading',
        progressPercent: 0,
        currentTimeSec: 0,
        durationSec: 0
      });

      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';

      const sourceUrl = URL.createObjectURL(file);
      video.src = sourceUrl;

      video.onloadedmetadata = async () => {
        const duration = video.duration || 10;
        const width = video.videoWidth || 1280;
        const height = video.videoHeight || 720;

        // Downscale slightly for rapid processing if high-res 4K
        const targetWidth = width > 1920 ? 1280 : width;
        const targetHeight = Math.round((targetWidth / width) * height);

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Failed to create canvas 2D rendering context'));
          return;
        }

        // Determine best supported MP4 / WebM container
        let mimeType = 'video/mp4;codecs=avc1';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/mp4';
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm;codecs=h264';
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm;codecs=vp9';
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
        }

        const stream = canvas.captureStream(30);
        let recorder: MediaRecorder;
        try {
          recorder = new MediaRecorder(stream, {
            mimeType,
            videoBitsPerSecond: 2500000
          });
        } catch {
          recorder = new MediaRecorder(stream);
        }

        const chunks: Blob[] = [];
        recorder.ondataavailable = e => {
          if (e.data && e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        recorder.onstop = () => {
          const finalMime = mimeType.includes('mp4') ? 'video/mp4' : mimeType;
          const outputBlob = new Blob(chunks, { type: finalMime });
          const outputUrl = URL.createObjectURL(outputBlob);

          URL.revokeObjectURL(sourceUrl);

          onProgress?.({
            status: 'completed',
            progressPercent: 100,
            currentTimeSec: duration,
            durationSec: duration,
            outputBlob,
            outputUrl
          });

          resolve({ blob: outputBlob, url: outputUrl, mimeType: finalMime });
        };

        recorder.start(100);

        onProgress?.({
          status: 'converting',
          progressPercent: 5,
          currentTimeSec: 0,
          durationSec: duration
        });

        // Frame rendering loop
        let isRecording = true;
        const renderFrame = () => {
          if (!isRecording) return;

          ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

          const current = video.currentTime;
          const percent = Math.min(98, Math.round((current / duration) * 100));

          onProgress?.({
            status: 'converting',
            progressPercent: percent,
            currentTimeSec: current,
            durationSec: duration
          });

          if (video.ended || current >= duration) {
            isRecording = false;
            recorder.stop();
          } else {
            requestAnimationFrame(renderFrame);
          }
        };

        video.onended = () => {
          if (isRecording) {
            isRecording = false;
            recorder.stop();
          }
        };

        video.onerror = () => {
          isRecording = false;
          reject(new Error('Error during video transcoding playback'));
        };

        video.play().then(() => {
          renderFrame();
        }).catch(err => {
          // If auto-play was blocked or codec needs direct playback
          recorder.stop();
          reject(err);
        });
      };

      video.onerror = (e) => {
        reject(new Error('Failed to load .mov file. Please check video file integrity.'));
      };
    });
  }
}
