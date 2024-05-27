import markdownit from 'markdown-it';
import { encodeHTML } from '@helpers/html';
import * as JSZip from 'jszip';

export const getObsImgZipFileData = async (resolution = '360px-compressed') => {
  return await fetch(`https://cdn.door43.org/obs/jpg/obs-images-${resolution}.zip`, { cache: 'force-cache' })
    .then((response) => response.arrayBuffer())
    .then((data) => JSZip.loadAsync(data));
};

export const getOBSImgURL = async ({ storyNum, frameNum, imgZipFileData = null, imgSrc = null, resolution = '360px-compressed' }) => {
  let imgFile;
  if (resolution && resolution == 'none') {
    return '';
  }
  if (imgZipFileData) {
    for (let fileName in imgZipFileData.files) {
      if (fileName.endsWith(`-${storyNum}-${frameNum}}.jpg`) || fileName.endsWith(`-${`${storyNum}`.padStart(2, '0')}-${`${frameNum}`.padStart(2, '0')}.jpg`)) {
        imgFile = imgZipFileData.files[fileName];
        break;
      }
    }
    if (imgFile) {
      const imgData = await imgFile.async('base64');
      return `data:image/jpeg;base64,${imgData}`;
    }
  } else if (imgSrc) {
    return imgSrc;
  } else {
    return `https://cdn.door43.org/obs/jpg/${resolution}/obs-en-${`${storyNum}`.padStart(2, '0')}-${`${frameNum}`.padStart(2, '0')}.jpg`;
  }
};

// This gets the obsData object for a while OBS project, for tS, RC and SB repos
export async function getOBSData(catalogEntry, zipFileData) {
  let obsRootPath = '';
  if (!catalogEntry || !catalogEntry.ingredients) {
    throw new Error('No valid ingredients found in this resource to render.');
  }
  catalogEntry.ingredients.forEach((ingredient) => {
    if (ingredient.identifier == 'obs') {
      obsRootPath = `${catalogEntry.repo.name.toLowerCase()}/${ingredient.path.replace(/^\.\/*/, '')}`.replace(/\/$/, '');
    }
  });
  if (!obsRootPath) {
    throw new Error('Unable to find an obs project in the manfiest.yaml file.');
  }

  let obsData = {
    title: catalogEntry.title,
    front: '',
    back: '',
    stories: [],
  };

  const md = markdownit();

  if (catalogEntry.metadata_type == 'ts') {
    let frontTitlePath = `${obsRootPath}/front/title.txt`;
    if (frontTitlePath in zipFileData.files) {
      obsData.title = await zipFileData.file(frontTitlePath).async('text');
    }
  } else {
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

  if (catalogEntry.metadata_type == 'ts') {
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
          content: `<p>
    ${await zipFileData.file(frameFilePath).async('text')}
</p>
`,
          imgURL: `https://cdn.door43.org/obs/jpg/360px/obs-en-${`${storyNum}`.padStart(2, '0')}-${`${frameNum}`.padStart(2, '0')}.jpg`,
        });
        frameNum++;
        frameFilePath = `${storyPath}/${`${frameNum}`.padStart(2, '0')}.txt`;
      }
      obsData.stories.push(story);
    }
  } else {
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
            } else if (i == doc.body.children.length - 1 && element.childNodes.length === 1 && element.childNodes[0].nodeName === 'EM') {
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

export async function convertOBSDataToHTML(obsData, imgZipFileData = null, resolution = '360px-compressed') {
  let html = `
<div class="section" id="obs" data-toc-title="${encodeHTML(obsData.title)}">
`;

  for (const story of obsData.stories) {
    html += `
<div class="section story" id="nav-obs-${story.storyNum}"  data-toc-title="${encodeHTML(story.title)}">
  <h1 class="obs-story-title title"><a href="#nav-obs-${story.storyNum}" class="header-link">${story.title}</a></h1>
`;
    let frames = story.frames;
    if (frames.length == 0) {
      frames = [
        {
          frameNum: 1,
          content: `<p>[NO FRAMES FOUND]</p>`,
        },
      ];
    }
    for (const frame of frames) {
      const link = `obs-${story.storyNum}-${frame.frameNum}`;
      html += `
<div class="article obs-story-frame" id="${link}">
`;
      if (resolution != 'none') {
        html += `
    <img src="${await getOBSImgURL({ storyNum: story.storyNum, frameNum: frame.frameNum, imgZipFileData, imgURL: frame.imgURL, resolution })}" alt="Frame ${story.storyNum}-${
          frame.frameNum
        }">
`;
      }
      html += `
    <div class="obs-frame-content">${frame.content}</div>
</div>
`;
    }
    if (story.bibleRef) {
      html += `
<div class="article obs-story-bible-ref" id="obs-story-bible-ref-${story.storyNum}">
  <em>${story.bibleRef}</em>
</div>
`;
    }
    html += `</div>`;
  }

  if (obsData.back) {
    html += `
<div class="section obs-back-section" data-toc-title="Back Matter">
    <div class="article obs-back-article" id="obs-back-article">
        ${obsData.back}
    </div>
</div>
`;
  }

  html += `
</div>
`;

  return html;
}
