import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fetch from 'node-fetch';
import { marked } from 'marked';
import { config, getGitHubImageUrl } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Ensure directories exist
async function ensureDirectories() {
  const dirs = [
    path.join(rootDir, config.articlesDir),
    path.join(rootDir, config.outputDir),
    path.join(rootDir, config.imagesDir)
  ];
  
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }
}

// Get list of markdown files
async function getMarkdownFiles() {
  const articlesPath = path.join(rootDir, config.articlesDir);
  const files = await fs.readdir(articlesPath);
  return files.filter(file => file.endsWith('.md'));
}

// Extract mermaid blocks with captions
function extractMermaidBlocks(content) {
  const blocks = [];
  // More robust regex that handles various spacing scenarios
  const mermaidRegex = /```mermaid\r?\n([\s\S]*?)```[\s\S]*?<!--\s*caption:\s*([^-]+?)\s*-->/g;
  
  let match;
  let figureNumber = 1;
  
  while ((match = mermaidRegex.exec(content)) !== null) {
    blocks.push({
      fullMatch: match[0],
      mermaidCode: match[1].trim(),
      caption: match[2].trim() || `Diagram ${figureNumber}`,
      figureNumber: figureNumber++,
      startIndex: match.index
    });
  }
  
  return blocks;
}

// Convert Mermaid to image using Mermaid Ink API
async function mermaidToImage(mermaidCode, outputPath) {
  try {
    // Encode mermaid code to base64
    const base64Code = Buffer.from(mermaidCode).toString('base64');
    const url = `${config.mermaidInkAPI}${base64Code}`;
    
    console.log(chalk.gray(`  Fetching diagram from Mermaid Ink API...`));
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch diagram: ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    await fs.writeFile(outputPath, Buffer.from(buffer));
    
    console.log(chalk.green(`  ✓ Image saved: ${path.basename(outputPath)}`));
    return true;
  } catch (error) {
    console.error(chalk.red(`  ✗ Error generating image: ${error.message}`));
    return false;
  }
}

// Generate safe filename from caption
function sanitizeFilename(caption, figureNumber) {
  const safe = caption
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `figure-${figureNumber}-${safe}.png`;
}

// Convert Markdown to HTML with Medium-friendly styling
function convertMarkdownToHtml(markdownContent, articleTitle) {
  // Configure marked options
  marked.setOptions({
    breaks: true,
    gfm: true
  });

  const htmlBody = marked.parse(markdownContent);
  
  // Wrap in a complete HTML document with Medium-friendly styling
  const htmlDocument = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${articleTitle}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
            line-height: 1.6;
            max-width: 700px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        }
        h1 {
            font-size: 2.5em;
            font-weight: 700;
            margin-bottom: 0.5em;
            line-height: 1.2;
        }
        h2 {
            font-size: 2em;
            font-weight: 600;
            margin-top: 1.5em;
            margin-bottom: 0.5em;
        }
        h3 {
            font-size: 1.5em;
            font-weight: 600;
            margin-top: 1.3em;
            margin-bottom: 0.5em;
        }
        p {
            margin-bottom: 1.5em;
        }
        img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 2em auto;
        }
        em {
            font-style: italic;
            display: block;
            text-align: center;
            color: #666;
            font-size: 0.9em;
            margin-top: -1.5em;
            margin-bottom: 2em;
        }
        code {
            background-color: #f5f5f5;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace;
            font-size: 0.9em;
        }
        pre {
            background-color: #f5f5f5;
            padding: 1em;
            border-radius: 5px;
            overflow-x: auto;
        }
        pre code {
            background-color: transparent;
            padding: 0;
        }
        blockquote {
            border-left: 3px solid #333;
            padding-left: 1em;
            margin-left: 0;
            font-style: italic;
            color: #666;
        }
        ul, ol {
            margin-bottom: 1.5em;
            padding-left: 2em;
        }
        li {
            margin-bottom: 0.5em;
        }
        hr {
            border: none;
            border-top: 1px solid #ddd;
            margin: 2em 0;
        }
        a {
            color: #0066cc;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
${htmlBody}
</body>
</html>`;

  return htmlDocument;
}

// Convert article
async function convertArticle(filename) {
  console.log(chalk.blue(`\n📄 Converting: ${filename}`));
  console.log(chalk.gray('─'.repeat(50)));
  
  const inputPath = path.join(rootDir, config.articlesDir, filename);
  const content = await fs.readFile(inputPath, 'utf-8');
  
  // Extract article title for HTML
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const articleTitle = titleMatch ? titleMatch[1] : filename.replace('.md', '');
  
  // Extract mermaid blocks
  const mermaidBlocks = extractMermaidBlocks(content);
  
  if (mermaidBlocks.length === 0) {
    console.log(chalk.yellow('  No Mermaid diagrams found in this article.'));
    
    // Just copy the file to output and create HTML
    const outputPathMd = path.join(rootDir, config.outputDir, filename);
    const outputPathHtml = path.join(rootDir, config.outputDir, filename.replace('.md', '.html'));
    
    await fs.writeFile(outputPathMd, content);
    const htmlContent = convertMarkdownToHtml(content, articleTitle);
    await fs.writeFile(outputPathHtml, htmlContent);
    
    console.log(chalk.green(`  ✓ Article copied to output (no conversion needed)`));
    console.log(chalk.green(`  ✓ HTML version created`));
    return;
  }
  
  console.log(chalk.cyan(`  Found ${mermaidBlocks.length} Mermaid diagram(s)\n`));
  
  let convertedContent = content;
  let offset = 0;
  
  // Process each mermaid block (in reverse to maintain string indices)
  for (let i = mermaidBlocks.length - 1; i >= 0; i--) {
    const block = mermaidBlocks[i];
    
    console.log(chalk.yellow(`  Processing Figure ${block.figureNumber}: ${block.caption}`));
    
    // Generate image filename
    const imageFilename = sanitizeFilename(block.caption, block.figureNumber);
    const imagePath = path.join(rootDir, config.imagesDir, imageFilename);
    
    // Convert mermaid to image
    const success = await mermaidToImage(block.mermaidCode, imagePath);
    
    if (success) {
      // Create replacement text with GitHub URL and caption
      const imageUrl = getGitHubImageUrl(imageFilename);
      const replacement = `![${config.captionPrefix} ${block.figureNumber}: ${block.caption}](${imageUrl})\n*${config.captionPrefix} ${block.figureNumber}: ${block.caption}*`;
      
      // Replace in content
      convertedContent = 
        convertedContent.slice(0, block.startIndex) + 
        replacement + 
        convertedContent.slice(block.startIndex + block.fullMatch.length);
    }
    
    console.log('');
  }
  
  // Save converted article (Markdown)
  const outputPathMd = path.join(rootDir, config.outputDir, filename);
  await fs.writeFile(outputPathMd, convertedContent);
  
  // Convert to HTML and save
  const outputPathHtml = path.join(rootDir, config.outputDir, filename.replace('.md', '.html'));
  const htmlContent = convertMarkdownToHtml(convertedContent, articleTitle);
  await fs.writeFile(outputPathHtml, htmlContent);
  
  console.log(chalk.green(`✓ Conversion complete!`));
  console.log(chalk.gray(`  Markdown: ${path.relative(rootDir, outputPathMd)}`));
  console.log(chalk.gray(`  HTML: ${path.relative(rootDir, outputPathHtml)}`));
}

// Main function
async function main() {
  console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║  Medium Articles Converter with Mermaid  ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════╝\n'));
  
  // Check if GitHub config is set
  if (config.githubUser === 'YOUR_GITHUB_USERNAME' || config.githubRepo === 'YOUR_REPO_NAME') {
    console.log(chalk.red('⚠️  Please update your GitHub configuration in scripts/config.js'));
    console.log(chalk.yellow('   Set your githubUser and githubRepo values\n'));
    process.exit(1);
  }
  
  // Ensure directories exist
  await ensureDirectories();
  
  // Get available markdown files
  const files = await getMarkdownFiles();
  
  if (files.length === 0) {
    console.log(chalk.yellow('No markdown files found in ./articles directory.'));
    console.log(chalk.gray('Please add your articles and try again.\n'));
    process.exit(0);
  }
  
  // Prompt user to select a file
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'file',
      message: 'Select an article to convert:',
      choices: files
    },
    {
      type: 'confirm',
      name: 'confirm',
      message: 'This will generate images and convert the article. Continue?',
      default: true
    }
  ]);
  
  if (!answers.confirm) {
    console.log(chalk.yellow('\nConversion cancelled.\n'));
    process.exit(0);
  }
  
  // Convert the selected article
  await convertArticle(answers.file);
  
  console.log(chalk.cyan('\n📋 Next steps:'));
  console.log(chalk.gray('  1. Commit and push the images to GitHub'));
  console.log(chalk.gray('  2. Import the .html file into Medium (recommended)'));
  console.log(chalk.gray('     OR use the .md file for other platforms'));
  console.log(chalk.gray('  3. Verify images display correctly\n'));
}

// Run
main().catch(error => {
  console.error(chalk.red('\n✗ Error:'), error.message);
  process.exit(1);
});
