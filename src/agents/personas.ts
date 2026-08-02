import { readFile } from 'fs/promises';
import { join } from 'path';
import type { Persona } from '../types/index.js';

const PERSONAS_DIR = 'personas';

const MODERATOR_FILE = 'moderator';

function parsePersonaMd(content: string, id: string): Persona {
  const lines = content.split('\n');

  let name = '';
  let nickname = '';
  let description = '';
  const interests: string[] = [];
  let votingPreference = '';
  let speakingStyle = '';

  let currentSection = '';

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('# ')) {
      name = trimmed.slice(2);
    } else if (trimmed.startsWith('## ')) {
      currentSection = trimmed.slice(3);
    } else if (trimmed.startsWith('- 昵称:')) {
      nickname = trimmed.split(':')[1]?.trim() || '';
    } else if (currentSection === '性格特点' && trimmed.startsWith('- ')) {
      description += (description ? '；' : '') + trimmed.slice(2);
    } else if (currentSection === '关注领域' && trimmed.startsWith('- ')) {
      interests.push(trimmed.slice(2));
    } else if (currentSection === '投票倾向' && trimmed.startsWith('- ')) {
      votingPreference += (votingPreference ? '；' : '') + trimmed.slice(2);
    } else if (currentSection === '说话风格' && trimmed.startsWith('- ')) {
      speakingStyle += (speakingStyle ? '；' : '') + trimmed.slice(2);
    }
  }

  return {
    id,
    name,
    nickname,
    description,
    interests,
    votingPreference,
    speakingStyle,
  };
}

export async function loadModeratorPersona(): Promise<Persona> {
  const filePath = join(PERSONAS_DIR, `${MODERATOR_FILE}.md`);
  const content = await readFile(filePath, 'utf-8');
  return parsePersonaMd(content, MODERATOR_FILE);
}

export function buildModeratorPrompt(persona: Persona): string {
  return `你是「${persona.nickname}」，一位资深的${persona.name}，开发者新闻的主编。

## 你的性格特点
${persona.description}

## 你关注的领域
${persona.interests.map((i) => `- ${i}`).join('\n')}

## 你的内容偏好
${persona.votingPreference}

## 你的说话风格
${persona.speakingStyle}

作为主编，你负责：
1. 从每日候选文章中挑出真正值得推荐的一篇
2. 用你的口吻写推荐语，真诚、务实、像在跟朋友分享

保持你的风格，真诚、务实、有深度。`;
}
