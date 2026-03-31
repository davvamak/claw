#!/usr/bin/env node
import { writeFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';

const FEEDS = [
  {
    section: 'Liverpool FC',
    sources: [
      { name: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/football/teams/liverpool/rss.xml' },
      { name: 'ESPN', url: 'https://www.espn.com/espn/rss/news' },
      { name: 'Goal.com', url: 'https://www.goal.com/feeds/en/news' }
    ]
  },
  {
    section: 'EPL',
    sources: [
      { name: 'BBC Football', url: 'https://feeds.bbci.co.uk/sport/football/rss.xml' },
      { name: 'Sky Sports', url: 'https://www.skysports.com/rss/11095' }
    ]
  },
  {
    section: 'Liverpool City',
    sources: [
      { name: 'Liverpool Echo', url: 'https://www.liverpoolecho.co.uk/?service=rss' },
      { name: 'BBC Liverpool', url: 'https://feeds.bbci.co.uk/news/england/merseyside/rss.xml' }
    ]
  }
];

function fetchRSS(url) {
  try {
    const xml = execSync(`curl -sL "${url}" -A "Mozilla/5.0" --max-time 10`, { encoding: 'utf-8' });
    const items = [];
    const itemMatches = xml.match(/<item[^>]*>[\s\S]*?<\/item>/g) || [];
    
    for (const item of itemMatches.slice(0, 5)) {
      const title = (item.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i) || [])[1]?.trim() || 'No title';
      const link = (item.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i) || [])[1]?.trim() || '';
      const desc = (item.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i) || [])[1]?.trim() || '';
      const pubDate = (item.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || [])[1]?.trim() || '';
      
      if (title && link) {
        items.push({
          title: title.replace(/<[^>]+>/g, ''),
          url: link.replace(/<[^>]+>/g, ''),
          snippet: desc.replace(/<[^>]+>/g, '').substring(0, 200) + '...',
          source: new URL(url).hostname.replace('www.', ''),
          timestamp: pubDate || new Date().toISOString()
        });
      }
    }
    return items;
  } catch (e) {
    console.error(`  ✗ Failed: ${url} - ${e.message}`);
    return [];
  }
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

console.log('🔍 Researcher Agent starting...\n');

const report = {
  date: todayStr(),
  generatedAt: new Date().toISOString(),
  sections: []
};

for (const topic of FEEDS) {
  console.log(`📰 ${topic.section}`);
  const section = { title: topic.section, articles: [] };
  
  for (const source of topic.sources) {
    const items = fetchRSS(source.url);
    console.log(`  ✓ ${source.name}: ${items.length} articles`);
    section.articles.push(...items);
  }
  
  // Deduplicate by URL
  const seen = new Set();
  section.articles = section.articles.filter(a => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  }).slice(0, 8);
  
  report.sections.push(section);
}

// Save to both locations
const dataDirs = ['/root/.openclaw/workspace/researcher/data', '/root/.openclaw/workspace/researcher/dashboard/data'];
for (const dir of dataDirs) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/${todayStr()}.json`, JSON.stringify(report, null, 2));
}

const total = report.sections.reduce((a, s) => a + s.articles.length, 0);
console.log(`\n✅ Saved ${total} articles to dashboard`);
