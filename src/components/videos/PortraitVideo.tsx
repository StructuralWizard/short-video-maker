import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  Audio,
  OffthreadVideo,
  interpolate,
  Img,
} from "remotion";
import { z } from "zod";
import { loadFont } from "@remotion/google-fonts/BarlowCondensed";

import {
  calculateVolume,
  createCaptionPages,
  shortVideoSchema,
} from "../utils";
import path from "path";

const { fontFamily } = loadFont(); // "Barlow Condensed"

type ShortVideoProps = z.infer<typeof shortVideoSchema>;

export const PortraitVideo = ({ scenes, music, config }: { scenes: any[]; music: any; config: any }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();

  const captionBackgroundColor = config.captionBackgroundColor ?? "blue";
  const captionTextColor = config.captionTextColor ?? "#ffffff";

  const activeStyle = {
    backgroundColor: captionBackgroundColor,
    padding: "10px",
    marginLeft: "-10px",
    marginRight: "-10px",
    borderRadius: "10px",
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

  // Calculate fade in and fade out volumes
  const fadeInDuration = 1; // 1 second fade in
  const fadeOutDuration = 2; // 2 seconds fade out
  const fadeInEndFrame = fadeInDuration * fps;
  const fadeOutStartFrame = durationInFrames - (fadeOutDuration * fps);

  // Calculate volume with both fade in and fade out
  const fadeOutVolume = interpolate(
    frame,
    [fadeOutStartFrame, durationInFrames],
    [musicVolume, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  const fadeInVolume = interpolate(
    frame,
    [0, fadeInEndFrame],
    [0, musicVolume],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  // Combine fade in and fade out volumes
  const finalVolume = frame < fadeInEndFrame 
    ? fadeInVolume 
    : frame > fadeOutStartFrame 
      ? fadeOutVolume 
      : musicVolume;
  console.log('Music URL:', music.url);

  return (
    <AbsoluteFill style={{ backgroundColor: "white" }}>
      <Audio
        loop
        src={music.url}
        startFrom={music.start * fps}
        endAt={music.end * fps}
        volume={() => finalVolume}
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

      {scenes.map((scene: any, i: number) => {
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
            <OffthreadVideo src={video} muted />
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
                      display: "flex",
                      justifyContent: "center",
                      zIndex: 2,
                    }}
                  >
                    {page.lines.map((line, k) => {
                      return (
                        <span
                          style={{
                            fontSize: "6em",
                            fontFamily: fontFamily + ', sans-serif',
                            fontWeight: "bold",
                            color: captionTextColor,
                            backgroundColor: captionBackgroundColor,
                            borderRadius: "2em",
                            padding: "0.25em 1.2em",
                            margin: "0.2em 0",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
                            display: "inline-block",
                            WebkitTextStroke: "1px black",
                            WebkitTextFillColor: captionTextColor,
                            textAlign: "center",
                          }}
                          key={`line-${k}`}
                        >
                          {line.texts.map((text) => text.text).join(" ")}
                        </span>
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
