export const config = {
  // Directories
  articlesDir: './articles',
  outputDir: './output',
  imagesDir: './images',
  
  // GitHub repository info (to be filled by user)
  githubUser: 'YOUR_GITHUB_USERNAME',
  githubRepo: 'YOUR_REPO_NAME',
  githubBranch: 'main',
  
  // Image settings
  imageFormat: 'png',
  mermaidTheme: 'default', // options: default, forest, dark, neutral
  
  // Caption settings
  captionPrefix: 'Figure',
  captionStyle: 'italic', // how to format captions in output
  
  // Mermaid Ink API
  mermaidInkAPI: 'https://mermaid.ink/img/'
};

// Helper to get GitHub raw URL for images
export function getGitHubImageUrl(imageName) {
  return `https://raw.githubusercontent.com/${config.githubUser}/${config.githubRepo}/${config.githubBranch}/images/${imageName}`;
}
