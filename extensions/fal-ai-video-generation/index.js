require('dotenv').config();
const fal = require('@fal-ai/serverless-client');

fal.config({
  credentials: process.env.FAL_API_KEY,
});

async function generateVideo(prompt) {
  try {
    const result = await fal.subscribe('fal-ai/fast-svd', {
      input: {
        prompt: prompt,
      },
    });

    console.log('Video generated successfully!');
    console.log('Output:', result);
    return result;
  } catch (error) {
    console.error('Error generating video:', error);
    throw error;
  }
}

const prompt = process.env.PROMPT || 'A futuristic cityscape at night with flying cars';
if (!prompt) {
  console.error('Please set the PROMPT environment variable');
  process.exit(1);
}

generateVideo(prompt);