import React from 'react';
import type { FC } from 'react';
import {
  AbsoluteFill,
  Sequence, 
  useCurrentFrame,
  useVideoConfig,
  Audio,
  OffthreadVideo,
  Img,
  VideoConfig,
} from "remotion";
import { z } from "zod";

import {
  calculateVolume,
  createCaptionPages,
  shortVideoSchema,
} from "../../shared/utils";
import { fontFamily } from "./fonts";

type Props = z.infer<typeof shortVideoSchema>;

export const PortraitVideo: FC<Props> = ({
  scenes,
  music,
  config,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const captionBackgroundColor = config.captionBackgroundColor ?? "#dd0000";
  const captionTextColor = config.captionTextColor ?? "#ffffff";

  const activeStyle = {
    backgroundColor: captionBackgroundColor,
    color: captionTextColor,
    padding: "10px 20px",
    marginLeft: "-10px",
    marginRight: "-10px",
    borderRadius: "50px",
    display: "inline-block",
    boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
  };

  const captionPosition = config.captionPosition ?? "center";
  let captionStyle = {};
  if (captionPosition === "top") {
    captionStyle = { top: 100 };
  }
  if (captionPosition === "center") {
    captionStyle = { top: "50%", transform: "translateY(-50%)" };
  }
  if (captionPosition === "bottom") {
    captionStyle = { bottom: 100 };
  }

  const [musicVolume, musicMuted] = calculateVolume(config.musicVolume);

  // Calculate total duration including padding
  const totalDurationInFrames = Math.round(
    scenes.reduce((acc, curr) => acc + curr.audio.duration, 0) * fps
  ) + (config.paddingBack ? Math.round((config.paddingBack / 1000) * fps) : 0);

  // Ensure music starts from 0 if the start time would make it end before the video
  const startFrom = Math.min(music.start * fps, totalDurationInFrames - 1);

  const fadeOutDuration = 2; // segundos
  const fadeOutStartFrame = totalDurationInFrames - fadeOutDuration * fps;

  const finalVolume = (frame: number) => {
    if (frame >= fadeOutStartFrame) {
      // Interpola o volume de musicVolume até 0 nos últimos 2 segundos
      return (
        musicVolume * (totalDurationInFrames - frame) / (fadeOutDuration * fps)
      );
    }
    return musicVolume;
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "white" }}>
      <Audio
        loop
        src={music.url}
        startFrom={music.start * fps}
        endAt={music.end * fps}
        volume={finalVolume}
        muted={musicMuted}
      />

      {config?.overlay && (
        <Img
          src={`http://localhost:3123/api/overlays/${config.overlay}.png`}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            zIndex: 1,
          }}
        />
      )}

      {scenes.map((scene, i) => {
        const { captions, audio, video } = scene;
        const pages = createCaptionPages({
          captions,
          lineMaxLength: 20,
          lineCount: 1,
          maxDistanceMs: 1000,
        });

        // Calculate the start and end time of the scene
        const startFrame =
          scenes.slice(0, i).reduce((acc, curr) => {
            return acc + curr.audio.duration;
          }, 0) * fps;
        let durationInFrames =
          scenes.slice(0, i + 1).reduce((acc, curr) => {
            return acc + curr.audio.duration;
          }, 0) * fps;
        if (config.paddingBack && i === scenes.length - 1) {
          durationInFrames += (config.paddingBack / 1000) * fps;
        }

        return (
          <Sequence
            from={startFrame}
            durationInFrames={durationInFrames}
            key={`scene-${i}`}
          >
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              overflow: 'hidden'
            }}>
              <OffthreadVideo 
                src={scene.videos[0]} 
                muted 
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            </div>
            <Audio src={audio.url} />
            {pages.map((page, j) => {
              return (
                <Sequence
                  key={`scene-${i}-page-${j}`}
                  from={Math.round((page.startMs / 1000) * fps)}
                  durationInFrames={Math.round(
                    ((page.endMs - page.startMs) / 1000) * fps,
                  )}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      width: "100%",
                      ...captionStyle,
                    }}
                  >
                    {page.lines.map((line, k) => {
                      return (
                        <p
                          style={{
                            fontSize: "5em",
                            fontFamily,
                            fontWeight: "black",
                            color: captionTextColor,
                            WebkitTextStroke: "2px black",
                            WebkitTextFillColor: captionTextColor,
                            textShadow: "0px 0px 10px black",
                            textAlign: "center",
                            width: "100%",
                            textTransform: "uppercase",
                          }}
                          key={`scene-${i}-page-${j}-line-${k}`}
                        >
                          {line.texts.map((text, l) => {
                            const active =
                              frame >=
                                startFrame + (text.startMs / 1000) * fps &&
                              frame <= startFrame + (text.endMs / 1000) * fps;
                            const wordStart = Math.round((text.startMs / 1000) * fps) - Math.round(0.1 * fps);
                            const wordEnd = Math.round((text.endMs / 1000) * fps) - Math.round(0.1 * fps);
                            return (
                              <>
                                <span
                                  style={{
                                    fontWeight: "bold",
                                    ...(active ? activeStyle : {}),
                                  }}
                                  key={`scene-${i}-page-${j}-line-${k}-text-${l}`}
                                >
                                  {text.text}
                                </span>
                                {l < line.texts.length - 1 ? " " : ""}
                              </>
                            );
                          })}
                        </p>
                      );
                    })}
                  </div>
                </Sequence>
              );
            })}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
