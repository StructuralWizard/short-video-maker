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
import { loadFont } from "@remotion/google-fonts/BarlowCondensed";

import {
  calculateVolume,
  createCaptionPages,
  shortVideoSchema,
  getOverlayUrl,
} from "../../shared/utils";

const { fontFamily } = loadFont(); // "Barlow Condensed"

type Props = z.infer<typeof shortVideoSchema> & {
  config: {
    durationMs: number;
    paddingBack?: number;
    captionPosition?: "top" | "center" | "bottom";
    captionBackgroundColor?: string;
    captionTextColor?: string;
    musicVolume?: string;
    overlay?: string;
    port?: number;
    hook?: string;
  };
};

export const LandscapeVideo: FC<Props> = ({
  scenes,
  music,
  config,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Log para depuração do hook
  console.log('[LandscapeVideo] frame:', frame, 'config.hook:', config?.hook);

  const captionBackgroundColor = config.captionBackgroundColor ?? "blue";
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
  const finalVolume = musicVolume;

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
          src={getOverlayUrl(config.overlay, config.port || 3123)}
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

      {config?.hook && frame === 0 && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            padding: "10px",
            width: "100%",
            height: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 2,
          }}
        >
          <p
            style={{
              fontSize: "10em",
              fontStyle: "italic",
              fontFamily,
              fontWeight: "black",
              color: captionTextColor,
              WebkitTextStroke: "2px black",
              WebkitTextFillColor: captionTextColor,
              textShadow: "0px 0px 10px black",
              textAlign: "center",
              width: "100%",
              textTransform: "uppercase",
              padding: "0 20px",
            }}
          >
            {config.hook}
          </p>
        </div>
      )}

      {scenes.map((scene, i) => {
        const { captions, audio, videos } = scene;
        const pages = createCaptionPages({
          captions,
          lineMaxLength: 30,
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
                            fontSize: "8em",
                            fontFamily: fontFamily,
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
