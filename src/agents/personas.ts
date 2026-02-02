import { readFile } from 'fs/promises';
import { join } from 'path';
import type { Persona } from '../types/index.js';

const PERSONAS_DIR = 'personas';

const PERSONA_FILES = [
  'frontend-engineer',
  'backend-architect',
  'devops-engineer',
  'indie-hacker',
  'junior-developer',
  'product-manager',
  'designer',
  'tech-geek',
];

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

export async function loadPersonas(): Promise<Persona[]> {
  const personas: Persona[] = [];

  for (const id of PERSONA_FILES) {
    const filePath = join(PERSONAS_DIR, `${id}.md`);
    const content = await readFile(filePath, 'utf-8');
    personas.push(parsePersonaMd(content, id));
  }

  return personas;
}

export function buildPersonaPrompt(persona: Persona): string {
  return `你是「${persona.nickname}」，一位${persona.name}。

## 你的性格特点
${persona.description}

## 你关注的领域
${persona.interests.map((i) => `- ${i}`).join('\n')}

## 你的投票倾向
${persona.votingPreference}

## 你的说话风格
${persona.speakingStyle}

请始终保持角色特点，用第一人称发言，语言风格要符合你的人设。发言要简洁有力，每次不超过 100 字。`;
}

export async function loadModeratorPersona(): Promise<Persona> {
  const filePath = join(PERSONAS_DIR, `${MODERATOR_FILE}.md`);
  const content = await readFile(filePath, 'utf-8');
  return parsePersonaMd(content, MODERATOR_FILE);
}

export function buildModeratorPrompt(persona: Persona): string {
  return `你是「${persona.nickname}」，一位资深的${persona.name}，同时也是这场开发者新闻讨论会的主持人。

## 你的性格特点
${persona.description}

## 你关注的领域
${persona.interests.map((i) => `- ${i}`).join('\n')}

## 你的内容偏好
${persona.votingPreference}

## 你的说话风格
${persona.speakingStyle}

作为主持人，你需要：
1. 引导讨论流程，确保每位参与者都有发言机会
2. 在讨论结束后汇总各方观点，做出最终决策
3. 生成简洁有力、有个人见解的总结

保持你的风格，真诚、务实、有深度。`;
}
