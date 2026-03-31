#!/usr/bin/env node
/**
 * Researcher Agent - Daily News Gatherer
 * Fetches Liverpool-focused news from multiple sources
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const TOPICS = [
  { name: 'Liverpool FC', queries: ['Liverpool FC news today', 'LFC transfer news', 'Liverpool match results'] },
  { name: 'EPL', queries: ['Premier League news today', 'EPL results fixtures', 'Premier League table'] },
  { name: 'Liverpool City', queries: ['Liverpool city news', 'Merseyside news today', 'Liverpool local news'] },
];

const SOURCES = {
  web: true,
  // Social sources (we'll use web search to find relevant posts)
  social: ['twitter.com', 'reddit.com', 'facebook.com', 'instagram.com']
};

function runSearch(query, count = 5) {
  try {
    // Using openclaw's web_search via CLI
    const result = execSync(
      `openclaw tools web_search "${query}" --count ${count}`,
      { encoding: 'utf-8', timeout: 30000 }
    );
    return JSON.parse(result);
  } catch (e) {
    console.error(`Search failed for "${query}":`, e.message);
    return [];
  }
}

function runFetch(url) {
  try {
    const result = execSync(
      `openclaw tools web_fetch "${url}"`,
      { encoding: 'utf-8', timeout: 30000 }
    );
    return result;
  } catch (e) {
    return null;
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

async function gatherNews() {
  const date = todayStr();
  const report = {
    date,
    generatedAt: new Date().toISOString(),
    sections: []
  };

  console.log(`🔍 Researcher Agent starting daily roundup for ${date}...`);

  for (const topic of TOPICS) {
    console.log(`  📰 Gathering: ${topic.name}`);
    const section = {
      id: generateId(),
      title: topic.name,
      articles: []
    };

    // Run all queries for this topic
    for (const query of topic.queries) {
      const results = runSearch(query, 3);
      
      for (const result of results) {
        // Skip if we already have this URL
        if (section.articles.find(a => a.url === result.url)) continue;

        // Fetch content for better summaries
        const content = runFetch(result.url);
        
        section.articles.push({
          id: generateId(),
          title: result.title,
          url: result.url,
          snippet: result.snippet,
          source: new URL(result.url).hostname.replace('www.', ''),
          fetched: !!content,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Deduplicate and limit
    section.articles = section.articles.slice(0, 8);
    report.sections.push(section);
    console.log(`     ✓ Found ${section.articles.length} articles`);
  }

  // Save report
  const dataDir = '/root/.openclaw/workspace/researcher/data';
  mkdirSync(dataDir, { recursive: true });
  
  const filename = `${dataDir}/${date}.json`;
  writeFileSync(filename, JSON.stringify(report, null, 2));
  
  console.log(`✅ Report saved: ${filename}`);
  console.log(`   Total sections: ${report.sections.length}`);
  console.log(`   Total articles: ${report.sections.reduce((a, s) => a + s.articles.length, 0)}`);
  
  return report;
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  gatherNews().catch(console.error);
}

export { gatherNews, todayStr };
