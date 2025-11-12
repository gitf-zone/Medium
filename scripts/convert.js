import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fetch from 'node-fetch';
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
  // Updated regex to allow blank lines between ``` and caption comment
  const mermaidRegex = /```mermaid\n([\s\S]*?)```\s*\n*\s*<!--\s*caption:\s*(.*?)\s*-->/g;
  
  let match;
  let figureNumber = 1;
  
  while ((match = mermaidRegex.exec(content)) !== null) {
    blocks.push({
      fullMatch: match[0],
      mermaidCode: match[1].trim(),
      caption: match[2] || `Diagram ${figureNumber}`,
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

// Convert article
async function convertArticle(filename) {
  console.log(chalk.blue(`\n📄 Converting: ${filename}`));
  console.log(chalk.gray('─'.repeat(50)));
  
  const inputPath = path.join(rootDir, config.articlesDir, filename);
  const content = await fs.readFile(inputPath, 'utf-8');
  
  // Extract mermaid blocks
  const mermaidBlocks = extractMermaidBlocks(content);
  
  if (mermaidBlocks.length === 0) {
    console.log(chalk.yellow('  No Mermaid diagrams found in this article.'));
    
    // Just copy the file to output
    const outputPath = path.join(rootDir, config.outputDir, filename);
    await fs.writeFile(outputPath, content);
    console.log(chalk.green(`  ✓ Article copied to output (no conversion needed)`));
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
  
  // Save converted article
  const outputPath = path.join(rootDir, config.outputDir, filename);
  await fs.writeFile(outputPath, convertedContent);
  
  console.log(chalk.green(`✓ Conversion complete!`));
  console.log(chalk.gray(`  Output: ${path.relative(rootDir, outputPath)}`));
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
  console.log(chalk.gray('  2. Import the converted article from ./output to Medium'));
  console.log(chalk.gray('  3. Verify images display correctly\n'));
}

// Run
main().catch(error => {
  console.error(chalk.red('\n✗ Error:'), error.message);
  process.exit(1);
});
