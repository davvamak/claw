#!/usr/bin/env node
/**
 * Advanced Researcher - Puppeteer-based scraper
 * Falls back to cheerio for static sites
 */

import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import { writeFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
});

const articles = [];

function fetchRSS(url) {
  try {
    const xml = execSync(`curl -sL "${url}" -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" --max-time 15`, { encoding: 'utf-8' });
    const items = [];
    
    // Try Atom format first (Reddit uses Atom)
    const entryMatches = xml.match(/<entry[^>]*>[\s\S]*?<\/entry>/g) || [];
    
    for (const entry of entryMatches.slice(0, 8)) {
      const title = (entry.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i) || [])[1]?.trim() || '';
      const linkMatch = entry.match(/<link[^>]*href="([^"]+)"[^>]*>/i);
      const link = linkMatch ? linkMatch[1] : '';
      
      if (title && link) {
        items.push({
          title: title.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
          url: link,
          source: new URL(url).hostname.replace('www.', ''),
          type: 'reddit'
        });
      }
    }
    
    // Fallback to RSS format
    if (items.length === 0) {
      const itemMatches = xml.match(/<item[^>]*>[\s\S]*?<\/item>/g) || [];
      
      for (const item of itemMatches.slice(0, 8)) {
        const title = (item.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i) || [])[1]?.trim() || '';
        const link = (item.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i) || [])[1]?.trim() || '';
        
        if (title && link) {
          items.push({
            title: title.replace(/<[^>]+>/g, ''),
            url: link.replace(/<[^>]+>/g, ''),
            source: new URL(url).hostname.replace('www.', ''),
            type: 'reddit'
          });
        }
      }
    }
    
    return items;
  } catch (e) {
    console.log(`     ✗ RSS failed: ${e.message}`);
    return [];
  }
}

async function fetchHTML(url) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    const html = await page.content();
    await page.close();
    return html;
  } catch (e) {
    await page.close();
    return null;
  }
}

async function scrapeReddit() {
  console.log('  🔴 Scraping Reddit r/LiverpoolFC...');
  const html = await fetchHTML('https://old.reddit.com/r/LiverpoolFC/hot/');
  if (!html) { console.log('     ✗ Failed to load'); return; }
  
  const $ = cheerio.load(html);
  const posts = [];
  
  $('.thing').each((i, el) => {
    if (i >= 8) return;
    const title = $(el).find('a.title').text().trim();
    const url = 'https://reddit.com' + $(el).find('a.title').attr('href');
    const votes = $(el).find('.score.unvoted').text().trim();
    
    if (title) {
      posts.push({
        title,
        url: url.startsWith('/r/') ? 'https://old.reddit.com' + url : url,
        source: 'reddit.com/r/LiverpoolFC',
        votes: votes || '0',
        type: 'reddit'
      });
    }
  });
  
  console.log(`     ✓ Found ${posts.length} posts`);
  articles.push(...posts.map(p => ({ ...p, section: 'Liverpool FC' })));
}

async function scrapeBBC() {
  console.log('  📰 Scraping BBC Sport...');
  const html = await fetchHTML('https://www.bbc.co.uk/sport/football/teams/liverpool');
  if (!html) { console.log('     ✗ Failed to load'); return; }
  
  const $ = cheerio.load(html);
  const stories = [];
  
  $('[data-testid="card"], article').each((i, el) => {
    if (i >= 8) return;
    const title = $(el).find('h2, h3, [data-testid="card-headline"]').first().text().trim();
    const link = $(el).find('a').first().attr('href');
    const summary = $(el).find('p').first().text().trim();
    
    if (title && link) {
      stories.push({
        title,
        url: link.startsWith('http') ? link : 'https://www.bbc.co.uk' + link,
        snippet: summary.substring(0, 150) + (summary.length > 150 ? '...' : ''),
        source: 'bbc.co.uk',
        type: 'news'
      });
    }
  });
  
  console.log(`     ✓ Found ${stories.length} stories`);
  articles.push(...stories.map(s => ({ ...s, section: 'Liverpool FC' })));
}

async function scrapeEcho() {
  console.log('  📰 Scraping Liverpool Echo...');
  const html = await fetchHTML('https://www.liverpoolecho.co.uk/all-about/liverpool-fc/');
  if (!html) { console.log('     ✗ Failed to load'); return; }
  
  const $ = cheerio.load(html);
  const stories = [];
  
  $('article, .content-item').each((i, el) => {
    if (i >= 6) return;
    const title = $(el).find('h2, h3, .headline').first().text().trim();
    const link = $(el).find('a').first().attr('href');
    const summary = $(el).find('p').first().text().trim();
    
    if (title && link && link.includes('/sport/')) {
      stories.push({
        title,
        url: link.startsWith('http') ? link : 'https://www.liverpoolecho.co.uk' + link,
        snippet: summary.substring(0, 150) + (summary.length > 150 ? '...' : ''),
        source: 'liverpoolecho.co.uk',
        type: 'news'
      });
    }
  });
  
  console.log(`     ✓ Found ${stories.length} stories`);
  articles.push(...stories.map(s => ({ ...s, section: 'Liverpool FC' })));
}

async function scrapeCityNews() {
  console.log('  🏙️ Scraping Liverpool City news...');
  const html = await fetchHTML('https://www.bbc.co.uk/news/england/merseyside');
  if (!html) { console.log('     ✗ Failed to load'); return; }
  
  const $ = cheerio.load(html);
  const stories = [];
  
  $('[data-testid="card"], .gs-c-promo').each((i, el) => {
    if (i >= 6) return;
    const title = $(el).find('h3, .gs-c-promo-heading').first().text().trim();
    const link = $(el).find('a').first().attr('href');
    const summary = $(el).find('p, .gs-c-promo-summary').first().text().trim();
    
    if (title && link) {
      stories.push({
        title,
        url: link.startsWith('http') ? link : 'https://www.bbc.co.uk' + link,
        snippet: summary.substring(0, 150) + (summary.length > 150 ? '...' : ''),
        source: 'bbc.co.uk/merseyside',
        type: 'local'
      });
    }
  });
  
  console.log(`     ✓ Found ${stories.length} local stories`);
  articles.push(...stories.map(s => ({ ...s, section: 'Liverpool City' })));
}

async function scrapeESPN() {
  console.log('  📺 Scraping ESPN...');
  const html = await fetchHTML('https://www.espn.com/soccer/team/_/id/364/liverpool');
  if (!html) { console.log('     ✗ Failed to load'); return; }
  
  const $ = cheerio.load(html);
  const stories = [];
  
  $('article, [data-mptype="story"]').each((i, el) => {
    if (i >= 6) return;
    const title = $(el).find('h1, h2, h3').first().text().trim();
    const link = $(el).find('a').first().attr('href');
    
    if (title && link) {
      stories.push({
        title,
        url: link.startsWith('http') ? link : 'https://www.espn.com' + link,
        snippet: '',
        source: 'espn.com',
        type: 'news'
      });
    }
  });
  
  console.log(`     ✓ Found ${stories.length} stories`);
  articles.push(...stories.map(s => ({ ...s, section: 'EPL' })));
}

// Main execution
console.log('🔍 Advanced Researcher starting...\n');

console.log('  🔴 Fetching Reddit RSS r/LiverpoolFC...');
const redditLFC = fetchRSS('https://www.reddit.com/r/LiverpoolFC/.rss');
console.log(`     ✓ Found ${redditLFC.length} posts`);
articles.push(...redditLFC.map(p => ({ ...p, section: 'Liverpool FC' })));

console.log('  🔴 Fetching Reddit RSS r/soccer...');
const redditSoccer = fetchRSS('https://www.reddit.com/r/soccer/.rss');
const soccerLFC = redditSoccer.filter(p => p.title.match(/liverpool|lfc|salah|klopp/i)).slice(0, 5);
console.log(`     ✓ Found ${soccerLFC.length} Liverpool-related posts`);
articles.push(...soccerLFC.map(p => ({ ...p, section: 'EPL' })));

await scrapeBBC();
await scrapeEcho();
await scrapeCityNews();
await scrapeESPN();

await browser.close();

// Organize into sections
const sections = [
  { title: 'Liverpool FC', articles: articles.filter(a => a.section === 'Liverpool FC').slice(0, 10) },
  { title: 'EPL', articles: articles.filter(a => a.section === 'EPL').slice(0, 6) },
  { title: 'Liverpool City', articles: articles.filter(a => a.section === 'Liverpool City').slice(0, 6) }
];

const report = {
  date: new Date().toISOString().split('T')[0],
  generatedAt: new Date().toISOString(),
  sections: sections.filter(s => s.articles.length > 0)
};

// Save
const dataDirs = ['/root/.openclaw/workspace/researcher/data', '/root/.openclaw/workspace/researcher/dashboard/data'];
for (const dir of dataDirs) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/${report.date}.json`, JSON.stringify(report, null, 2));
}

const total = sections.reduce((a, s) => a + s.articles.length, 0);
console.log(`\n✅ Saved ${total} articles to dashboard`);
