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
import "../../../fonts/HeadingNowTrial-27Extrabold.ttf";
import "../../../fonts/fonts.css";

import {
  calculateVolume,
  createCaptionPages,
  shortVideoSchema,
  getOverlayUrl,
} from "../../shared/utils";
import { fontFamily } from "./fonts";

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

export const PortraitVideo: FC<Props> = ({
  scenes,
  music,
  config,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logs detalhados para depuração
  console.log('[PortraitVideo] Component rendered with config:', {
    frame,
    hook: config?.hook,
    captionTextColor: config?.captionTextColor,
    overlay: config?.overlay,
    musicVolume: config?.musicVolume,
    scenesCount: scenes.length
  });

  const captionBackgroundColor = config.captionBackgroundColor ?? "#dd0000";
  const captionTextColor = config.captionTextColor ?? "#ffffff";

  // Forçar cor do texto para verde para garantir visibilidade
  const hookTextColor = "#00ff00";

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

  // Helper to split hook into blocks with font size tiers and keep short words together
  function splitHookIntoBlocks(hook: string) {
    if (!hook) return [];
    
    const words = hook.split(/\s+/);
    const blocks: { text: string; fontSize: string; isHighlighted?: boolean }[] = [];
    let current = '';
    let i = 0;
    
    while (i < words.length) {
      let word = words[i];
      // Novo: regex para detectar *palavra* com pontuação após o asterisco
      const match = word.match(/^\*(.+?)\*(\W*)$/);
      const isHighlighted = !!match;
      let cleanWord = word;
      if (isHighlighted) {
        cleanWord = match[1] + (match[2] || '');
      }
      const len = [...cleanWord].length;
      
      // If word is short (<=3 chars), try to combine with next word
      if (len <= 3 && i + 1 < words.length) {
        const nextWord = words[i + 1];
        const nextMatch = nextWord.match(/^\*(.+?)\*(\W*)$/);
        const nextIsHighlighted = !!nextMatch;
        const nextWordClean = nextIsHighlighted ? nextMatch[1] + (nextMatch[2] || '') : nextWord;
        if (isHighlighted || nextIsHighlighted || [...nextWordClean].length <= 3) {
          cleanWord = cleanWord + ' ' + nextWordClean;
          if (isHighlighted || nextIsHighlighted) {
            if (current) {
              blocks.push({ text: current.trim(), fontSize: getFontSize([...current.trim()].length) });
              current = '';
            }
            blocks.push({ 
              text: cleanWord, 
              fontSize: getFontSize([...cleanWord].length),
              isHighlighted: true 
            });
            i += 2;
            continue;
          }
          i++;
        }
      }
      
      const wordLen = [...cleanWord].length;
      let fontSize = '13em';
      if (wordLen > 12) fontSize = '5em';
      else if (wordLen > 9) fontSize = '8em';
      else if (wordLen > 7) fontSize = '11em';
      
      if (isHighlighted) {
        if (current) {
          blocks.push({ text: current.trim(), fontSize: getFontSize([...current.trim()].length) });
          current = '';
        }
        blocks.push({ text: cleanWord, fontSize, isHighlighted: true });
      } else if (wordLen > 7) {
        if (current) {
          blocks.push({ text: current.trim(), fontSize: getFontSize([...current.trim()].length) });
          current = '';
        }
        blocks.push({ text: cleanWord, fontSize });
      } else {
        if ((current + ' ' + cleanWord).trim().length > 7) {
          if (current) blocks.push({ text: current.trim(), fontSize: getFontSize([...current.trim()].length) });
          current = cleanWord;
        } else {
          current += (current ? ' ' : '') + cleanWord;
        }
      }
      i++;
    }
    
    if (current) blocks.push({ text: current.trim(), fontSize: getFontSize([...current.trim()].length) });
    return blocks;
  }

  function getFontSize(len: number) {
    if (len > 10) return '11em';
    if (len > 7) return '9em';
    return '13em';
  }

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

      {config?.hook && frame === 0 && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 999,
            backgroundColor: "rgba(0,0,0,0.4)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: "100%",
            }}
          >
            {splitHookIntoBlocks(config.hook).map((block, idx) => (
              <span
                key={idx}
                style={{
                  fontSize: block.fontSize,
                  fontFamily: block.isHighlighted ? "'BenzGrotesk', sans-serif" : "'BenzGrotesk', sans-serif",
                  fontStyle: "italic",
                  lineHeight: "0.8",
                  fontWeight: "900",
                  color: block.isHighlighted ? "#ffff00" : "#ffffff",
                  WebkitTextStroke: block.isHighlighted ? "4px #000000" : "4px #000000",
                  WebkitTextFillColor: block.isHighlighted ? "#ffff00" : "#ffffff",
                  textShadow: "5px 5px 20px #000000",
                  textAlign: "center",
                  width: "100%",
                  textTransform: "uppercase",
                  letterSpacing: "-0.05em",
                  opacity: 0.8,
                  marginBottom: "0.1em",
                  display: "block",
                }}
              >
                {block.text}
              </span>
            ))}
          </div>
        </div>
      )}

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
            zIndex: 1000,
            pointerEvents: "none",
          }}
        />
      )}

      {scenes.map((scene, i) => {
        const { captions, audio, videos } = scene;
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
                      zIndex: 1001,
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
