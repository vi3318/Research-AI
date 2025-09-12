// Test title generation function directly
function generateSessionTitle(query) {
  if (!query) {
    const topics = [
      'Machine Learning Research', 'AI Applications', 'Data Science Study',
      'Neural Networks Analysis', 'Computer Vision Project', 'NLP Research',
      'Deep Learning Investigation', 'Algorithm Development', 'Tech Innovation',
      'Research Exploration'
    ];
    return topics[Math.floor(Math.random() * topics.length)];
  }

  const cleanQuery = query
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(' ')
    .filter(word => word.length > 2)
    .slice(0, 4)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  return cleanQuery || 'Research Session';
}

console.log('Title for "reinforcement learning":', generateSessionTitle('reinforcement learning'));
console.log('Title for "machine learning healthcare":', generateSessionTitle('machine learning healthcare'));
console.log('Title for "transformer models for natural language processing":', generateSessionTitle('transformer models for natural language processing'));
