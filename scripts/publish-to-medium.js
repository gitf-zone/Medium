import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fetch from 'node-fetch';
import { config } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Get list of converted markdown files
async function getConvertedFiles() {
  const outputPath = path.join(rootDir, config.outputDir);
  try {
    const files = await fs.readdir(outputPath);
    return files.filter(file => file.endsWith('.md'));
  } catch (error) {
    return [];
  }
}

// Get Medium user info
async function getMediumUser(token) {
  const response = await fetch(`${config.mediumAPI}/me`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get user info: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data;
}

// Convert markdown to Medium's HTML format
function convertToMediumHtml(markdown) {
  // Medium accepts a subset of HTML
  // We need to convert our markdown to Medium-compatible HTML
  let html = markdown;

  // IMPORTANT: Convert images FIRST before other conversions
  // Convert images - Medium needs <img> tags
  // Pattern: ![alt text](url)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');

  // Convert headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Convert bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Convert links
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');

  // Convert code blocks
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Convert blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

  // Convert lists
  html = html.replace(/^\- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  html = html.replace(/<\/li>\n<li>/g, '</li><li>');

  // Convert paragraphs (add <p> tags around text blocks)
  const lines = html.split('\n');
  const processed = [];
  let inParagraph = false;

  for (let line of lines) {
    const trimmed = line.trim();
    
    // Skip if empty or already tagged
    if (!trimmed || trimmed.startsWith('<')) {
      if (inParagraph) {
        processed.push('</p>');
        inParagraph = false;
      }
      if (trimmed) {
        processed.push(trimmed);
      }
    } else {
      if (!inParagraph) {
        processed.push('<p>');
        inParagraph = true;
      }
      processed.push(trimmed);
    }
  }

  if (inParagraph) {
    processed.push('</p>');
  }

  return processed.join('\n');
}

// Publish to Medium
async function publishToMedium(token, userId, article) {
  const url = `${config.mediumAPI}/users/${userId}/posts`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(article)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to publish: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data;
}

// Extract title from markdown
function extractTitle(markdown) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1] : 'Untitled';
}

// Main function
async function main() {
  console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║     Publish to Medium via API             ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════╝\n'));

  // Check if Medium token is configured
  if (config.mediumToken === 'YOUR_MEDIUM_INTEGRATION_TOKEN') {
    console.log(chalk.red('⚠️  Please configure your Medium integration token'));
    console.log(chalk.yellow('   1. Go to https://medium.com/me/settings/security'));
    console.log(chalk.yellow('   2. Scroll to "Integration tokens"'));
    console.log(chalk.yellow('   3. Create a new token'));
    console.log(chalk.yellow('   4. Add it to scripts/config.js as mediumToken\n'));
    process.exit(1);
  }

  // Get available files
  const files = await getConvertedFiles();

  if (files.length === 0) {
    console.log(chalk.yellow('No converted articles found in ./output directory.'));
    console.log(chalk.gray('Please run "npm run convert" first.\n'));
    process.exit(0);
  }

  // Verify Medium token
  console.log(chalk.gray('Verifying Medium credentials...'));
  let user;
  try {
    user = await getMediumUser(config.mediumToken);
    console.log(chalk.green(`✓ Connected as: ${user.name} (@${user.username})\n`));
  } catch (error) {
    console.log(chalk.red(`✗ Failed to authenticate with Medium`));
    console.log(chalk.yellow(`  Error: ${error.message}`));
    console.log(chalk.yellow(`  Please check your Medium token in scripts/config.js\n`));
    process.exit(1);
  }

  // Prompt user to select a file and options
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'file',
      message: 'Select an article to publish:',
      choices: files
    },
    {
      type: 'list',
      name: 'publishStatus',
      message: 'Publication status:',
      choices: [
        { name: 'Draft (recommended - create then review/publish on Medium)', value: 'draft' },
        { name: 'Public (publish immediately - use with caution)', value: 'public' },
        { name: 'Unlisted (publish but not visible on profile)', value: 'unlisted' }
      ],
      default: 'draft'
    },
    {
      type: 'input',
      name: 'tags',
      message: 'Tags (comma-separated, max 5):',
      default: 'linux,kde,remote-desktop'
    },
    {
      type: 'list',
      name: 'contentFormat',
      message: 'Content format:',
      choices: [
        { name: 'HTML', value: 'html' },
        { name: 'Markdown (may have formatting issues)', value: 'markdown' }
      ],
      default: 'html'
    },
    {
      type: 'input',
      name: 'canonicalUrl',
      message: 'Canonical URL (optional, press Enter to skip):',
      default: ''
    },
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Ready to publish?',
      default: true
    }
  ]);

  if (!answers.confirm) {
    console.log(chalk.yellow('\nPublication cancelled.\n'));
    process.exit(0);
  }

  // Read the article
  const articlePath = path.join(rootDir, config.outputDir, answers.file);
  const content = await fs.readFile(articlePath, 'utf-8');

  // Extract title
  const title = extractTitle(content);

  // Parse tags
  const tags = answers.tags
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0)
    .slice(0, 5); // Maximum 5 tags

  // Prepare article data
  const article = {
    title: title,
    contentFormat: answers.contentFormat,
    content: answers.contentFormat === 'html' ? convertToMediumHtml(content) : content,
    publishStatus: answers.publishStatus,
    tags: tags
  };

  if (answers.canonicalUrl) {
    article.canonicalUrl = answers.canonicalUrl;
  }

  // Publish
  console.log(chalk.blue('\n📤 Publishing to Medium...'));
  console.log(chalk.gray('─'.repeat(50)));

  try {
    const result = await publishToMedium(config.mediumToken, user.id, article);

    console.log(chalk.green('\n✓ Successfully created on Medium!'));
    console.log(chalk.gray(`  Title: ${result.title}`));
    console.log(chalk.gray(`  Status: ${result.publishStatus}`));
    console.log(chalk.cyan(`  URL: ${result.url}\n`));

    if (result.publishStatus === 'draft') {
      console.log(chalk.yellow('📝 Your article is saved as a draft.'));
      console.log(chalk.yellow('   Next steps:'));
      console.log(chalk.yellow('   1. Go to Medium and open your draft'));
      console.log(chalk.yellow('   2. Review formatting and images'));
      console.log(chalk.yellow('   3. Add any final touches in Medium\'s editor'));
      console.log(chalk.yellow('   4. Click "Publish" when ready\n'));
    } else if (result.publishStatus === 'public') {
      console.log(chalk.green('🎉 Your article is live!\n'));
    }
  } catch (error) {
    console.log(chalk.red('\n✗ Failed to publish'));
    console.log(chalk.yellow(`  Error: ${error.message}\n`));
    process.exit(1);
  }
}

// Run
main().catch(error => {
  console.error(chalk.red('\n✗ Error:'), error.message);
  process.exit(1);
});
