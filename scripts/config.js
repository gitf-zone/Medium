export const config = {
  // Directories
  articlesDir: './articles',
  outputDir: './output',
  imagesDir: './images',

  // GitHub repository info (to be filled by user)
  githubUser: 'gitf-zone',
  githubRepo: 'Medium',
  githubBranch: 'main',

  // Medium API (to be filled by user)
  mediumToken: 'YOUR_MEDIUM_INTEGRATION_TOKEN',

  // Image settings
  imageFormat: 'png',
  mermaidTheme: 'default', // options: default, forest, dark, neutral

  // Caption settings
  captionPrefix: 'Figure',
  captionStyle: 'italic', // how to format captions in output

  // Mermaid Ink API
  mermaidInkAPI: 'https://mermaid.ink/img/',

  // Medium API
  mediumAPI: 'https://api.medium.com/v1',
};

// Helper to get GitHub raw URL for images
export function getGitHubImageUrl(imageName) {
  return `https://raw.githubusercontent.com/${config.githubUser}/${config.githubRepo}/${config.githubBranch}/images/${imageName}`;
}
