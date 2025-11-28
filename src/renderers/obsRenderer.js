/**
 * Open Bible Stories HTML Renderer
 * 
 * Standalone library for generating HTML from Open Bible Stories resources.
 * Can be used independently of React or any UI framework.
 * 
 * @module obsRenderer
 * @author unfoldingWord
 * @license MIT
 */

import * as JSZip from 'jszip';
import markdownit from 'markdown-it';
import { encodeHTML } from '@helpers/html';

const webCss = `
.article img {
  display: block;
  margin: 0 auto;
  width: 100%;
  max-width: 640px;
}

a.header-link {
  font-weight: inherit !important;
  font-size: inherit !important;
  color: #000000;
  text-decoration: none;
}

a.header-link:hover::after {
  content: '#';
  padding-left: 5px;
  color: blue;
  display: inline-block;
}
`;

const printCss = `
.obs-story-title {
  text-align: center;
}

#pagedjs-print .obs-story-title {
  break-after: page !important;
  padding-top: 300px;
}

.article {
  break-before: auto !important;
  break-after: auto !important;
}
`;

/**
 * Fetch and load zip file data
 * @private
 */
async function fetchZipFileData(catalogEntry, authToken) {
  if (!catalogEntry?.zipball_url) {
    throw new Error('No zipball URL found in catalog entry');
  }

  try {
    const response = await fetch(catalogEntry.zipball_url, {
      cache: 'default',
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch zipball: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return JSZip.loadAsync(arrayBuffer);
  } catch (error) {
    console.error('Error fetching zip file:', error);
    throw error;
  }
}

/**
 * Get OBS image URL (either from CDN or from zip file as base64)
 * @private
 */
async function getOBSImgURL({ storyNum, frameNum, imgZipFileData = null, resolution = '360px' }) {
  if (resolution === 'none') {
    return '';
  }

  if (imgZipFileData) {
    // Find image in zip file
    for (let fileName in imgZipFileData.files) {
      if (
        fileName.endsWith(`-${storyNum}-${frameNum}.jpg`) ||
        fileName.endsWith(`-${`${storyNum}`.padStart(2, '0')}-${`${frameNum}`.padStart(2, '0')}.jpg`)
      ) {
        const imgFile = imgZipFileData.files[fileName];
        const imgData = await imgFile.async('base64');
        return `data:image/jpeg;base64,${imgData}`;
      }
    }
  }

  // Fallback to CDN
  return `https://cdn.door43.org/obs/jpg/${resolution}/obs-en-${`${storyNum}`.padStart(2, '0')}-${`${frameNum}`.padStart(2, '0')}.jpg`;
}

/**
 * Extract OBS data from zip file
 * @private
 */
async function getOBSData(catalogEntry, zipFileData) {
  let obsRootPath = '';
  
  if (!catalogEntry || !catalogEntry.ingredients) {
    throw new Error('No valid ingredients found in this resource to render.');
  }

  catalogEntry.ingredients.forEach((ingredient) => {
    if (ingredient.identifier === 'obs') {
      obsRootPath = `${catalogEntry.repo.name.toLowerCase()}/${ingredient.path.replace(/^\.\/*/, '')}`.replace(/\/$/, '');
    }
  });

  if (!obsRootPath) {
    throw new Error('Unable to find an obs project in the manifest.yaml file.');
  }

  let obsData = {
    title: catalogEntry.title,
    front: '',
    back: '',
    stories: [],
  };

  const md = markdownit();

  // Handle translationStudio (ts) format
  if (catalogEntry.metadata_type === 'ts') {
    let frontTitlePath = `${obsRootPath}/front/title.txt`;
    if (frontTitlePath in zipFileData.files) {
      obsData.title = await zipFileData.file(frontTitlePath).async('text');
    }
  } else {
    // Handle Resource Container (rc) format
    let frontFilePath = `${obsRootPath}/front.md`;
    if (frontFilePath in zipFileData.files) {
      obsData.front = md.render(await zipFileData.file(frontFilePath).async('text'));
    } else {
      frontFilePath = `${obsRootPath}/front/intro.md`;
      if (frontFilePath in zipFileData.files) {
        obsData.front = md.render(await zipFileData.file(frontFilePath).async('text'));
      }
    }

    let backFilePath = `${obsRootPath}/back.md`;
    if (backFilePath in zipFileData.files) {
      obsData.back = md.render(await zipFileData.file(backFilePath).async('text'));
    } else {
      backFilePath = `${obsRootPath}/back/intro.md`;
      if (backFilePath in zipFileData.files) {
        obsData.back = md.render(await zipFileData.file(backFilePath).async('text'));
      }
    }
  }

  // Process 50 stories
  if (catalogEntry.metadata_type === 'ts') {
    // translationStudio format
    for (let storyIdx = 0; storyIdx < 50; storyIdx++) {
      const storyNum = storyIdx + 1;
      const story = {
        storyNum,
        title: `${storyNum}. [NO TITLE]`,
        frames: [],
        bibleRef: '',
      };

      let storyPath = `${obsRootPath}/${`${storyNum}`.padStart(2, '0')}`;
      if (!(storyPath + '/' in zipFileData.files)) {
        story.title = `${storyNum}. [STORY NOT FOUND]`;
        obsData.stories.push(story);
        continue;
      }

      let storyTitlePath = `${storyPath}/title.txt`;
      if (storyTitlePath in zipFileData.files) {
        story.title = await zipFileData.file(storyTitlePath).async('text');
      }

      let bibleRefPath = `${obsRootPath}/${`${storyNum}`.padStart(2, '0')}/reference.txt`;
      if (bibleRefPath in zipFileData.files) {
        story.bibleRef = await zipFileData.file(bibleRefPath).async('text');
      }

      let frameNum = 1;
      let frameFilePath = `${storyPath}/${`${frameNum}`.padStart(2, '0')}.txt`;
      while (frameFilePath in zipFileData.files) {
        story.frames.push({
          frameNum,
          content: `<p>${await zipFileData.file(frameFilePath).async('text')}</p>`,
          imgURL: `https://cdn.door43.org/obs/jpg/360px/obs-en-${`${storyNum}`.padStart(2, '0')}-${`${frameNum}`.padStart(2, '0')}.jpg`,
        });
        frameNum++;
        frameFilePath = `${storyPath}/${`${frameNum}`.padStart(2, '0')}.txt`;
      }
      obsData.stories.push(story);
    }
  } else {
    // Resource Container format
    const frameNumRegex = /-(\d+)\.jpg/;
    const parser = new DOMParser();
    
    for (let storyIdx = 0; storyIdx < 50; storyIdx++) {
      const storyNum = storyIdx + 1;
      const story = {
        storyNum,
        title: `${storyNum}. [NO TITLE]`,
        frames: [],
        bibleRef: '',
      };

      let obsStoryFilePath = `${obsRootPath}/${`${storyNum}`.padStart(2, '0')}.md`;
      if (obsStoryFilePath in zipFileData.files) {
        const html = md.render(await zipFileData.file(obsStoryFilePath).async('text'));
        const doc = parser.parseFromString(html, 'text/html');

        let frame = null;
        for (let i = 0; i < doc.body.children.length; i++) {
          const element = doc.body.children[i];
          
          if (element.nodeName === 'P') {
            if (element.querySelector('img')) {
              const img = element.querySelector('img');
              const match = img.src.match(frameNumRegex);
              if (match) {
                if (frame) {
                  story.frames.push(frame);
                }
                const frameNum = parseInt(match[1]);
                frame = {
                  frameNum,
                  imgURL: `https://cdn.door43.org/obs/jpg/360px/obs-en-${`${storyNum}`.padStart(2, '0')}-${`${frameNum}`.padStart(2, '0')}.jpg`,
                  content: '',
                };
              }
            } else if (i === doc.body.children.length - 1 && element.childNodes.length === 1 && element.childNodes[0].nodeName === 'EM') {
              story.frames.push(frame);
              frame = null;
              story.bibleRef = element.childNodes[0].textContent;
            } else if (frame) {
              frame.content += element.outerHTML;
            }
          } else if (/^H[1-6]$/.test(element.nodeName)) {
            story.title = element.textContent;
          }
        }
        if (frame) {
          story.frames.push(frame);
        }
      } else {
        story.title = `${storyNum}. [STORY NOT FOUND]`;
      }
      obsData.stories.push(story);
    }
  }

  return obsData;
}

/**
 * Convert OBS data to HTML
 * @private
 */
async function convertOBSDataToHTML(obsData, imgZipFileData = null, resolution = '360px', chapters = null) {
  let html = `
<div class="section" id="obs" data-toc-title="${encodeHTML(obsData.title)}">
`;

  for (const story of obsData.stories) {
    // Skip if specific chapters requested and this isn't one of them
    if (chapters && !chapters.includes(story.storyNum.toString())) {
      continue;
    }

    html += `
<div class="section story" id="nav-obs-${story.storyNum}" data-toc-title="${encodeHTML(story.title)}">
  <h1 class="obs-story-title title"><a href="#nav-obs-${story.storyNum}" class="header-link">${story.title}</a></h1>
`;

    let frames = story.frames;
    if (frames.length === 0) {
      frames = [
        {
          frameNum: 0,
          imgURL: '',
          content: '<p>[NO FRAMES FOUND]</p>',
        },
      ];
    }

    for (const frame of frames) {
      const frameLink = `nav-obs-${story.storyNum}-${frame.frameNum}`;
      let imgURL = frame.imgURL;
      
      if (imgZipFileData) {
        imgURL = await getOBSImgURL({
          storyNum: story.storyNum,
          frameNum: frame.frameNum,
          imgZipFileData,
          resolution,
        });
      }

      html += `
  <div class="article frame" id="${frameLink}">
`;
      if (imgURL && resolution !== 'none') {
        html += `
    <img src="${imgURL}" alt="OBS Image ${story.storyNum}-${frame.frameNum}">
`;
      }
      html += `
    ${frame.content}
  </div>
`;
    }

    if (story.bibleRef) {
      html += `
  <p><em>${story.bibleRef}</em></p>
`;
    }

    html += `
</div>
`;
  }

  html += `
</div>
`;

  return html;
}

/**
 * Main function to generate Open Bible Stories HTML
 * 
 * @param {Object} params - Configuration parameters
 * @param {string} params.owner - Repository owner (e.g., 'unfoldingWord')
 * @param {string} params.repo - Repository name (e.g., 'en_obs')
 * @param {string} params.ref - Branch or tag name (e.g., 'master', 'v9')
 * @param {Object} params.catalogEntry - DCS catalog entry object
 * @param {string} [params.authToken] - Optional authentication token
 * @param {string} [params.resolution='360px'] - Image resolution ('360px', '2160px', or 'none')
 * @param {Array<string>} [params.chapters] - Optional array of chapter numbers to include
 * @param {Function} [params.onProgress] - Progress callback function
 * @returns {Promise<Object>} Object containing {html, css, builtWith}
 */
export async function generateOpenBibleStoriesHtml({
  owner,
  repo,
  ref,
  catalogEntry,
  authToken = null,
  resolution = '360px',
  chapters = null,
  onProgress = null
}) {
  try {
    const progress = (message, percent) => {
      if (onProgress) onProgress(message, percent);
    };

    progress('Fetching OBS content...', 10);

    // Fetch zip file
    const zipFileData = await fetchZipFileData(catalogEntry, authToken);

    progress('Extracting OBS data...', 40);

    // Extract OBS data
    const obsData = await getOBSData(catalogEntry, zipFileData);

    progress('Building HTML...', 70);

    // Generate HTML
    const html = await convertOBSDataToHTML(obsData, null, resolution, chapters);

    progress('Complete!', 100);

    return {
      html,
      css: { web: webCss, print: printCss },
      builtWith: {
        obs: catalogEntry
      },
      obsData // Include for front/back matter
    };
  } catch (error) {
    console.error('Error generating Open Bible Stories HTML:', error);
    throw error;
  }
}

export { getOBSData, convertOBSDataToHTML };
