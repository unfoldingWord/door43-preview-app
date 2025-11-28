import { useState, useEffect, useContext } from 'react';
import markdownit from 'markdown-it';
import yaml from 'yaml';
import { AppContext } from '@components/App.context';

export default function useGenerateTranslationAcademyFileContents({ catalogEntry, zipFileData, useRcLinks = false }) {
  const [taFileContents, setTaFileContents] = useState();
  const {
    actions: { setErrorMessage }
  } = useContext(AppContext);

  useEffect(() => {
    const getFileContents = async () => {
      const articleMap = {};
      catalogEntry.ingredients
        .sort((a, b) => (a.sort > b.sort ? 1 : b.sort > a.sort ? -1 : 0))
        .forEach((ingredient, i) => {
          const manualPath = `${catalogEntry.repo.name.toLowerCase()}/${ingredient.path.replace(/^\.\//, '')}`;
          if (!(manualPath + '/' in zipFileData.files)) {
            setErrorMessage(`Manual given in manifest file does not exist: ${ingredient.identifier}`);
            return;
          }
          articleMap[ingredient.identifier] = {
            id: ingredient.identifier,
            sort: ingredient.sort ? ingredient.sort : i,
            title: ingredient.title,
            articles: {},
            toc: null,
            config: null,
          };
        });
      const entries = Object.keys(zipFileData.files)
        .filter(
          (name) =>
            name.split('/').slice(1, 2) in articleMap &&
            (name.endsWith('01.md') || name.endsWith('title.md') || name.endsWith('sub-title.md') || name.endsWith('toc.yaml') || name.endsWith('config.yaml'))
        )
        .map((name) => zipFileData.files[name]);
      const listOfPromises = entries.map((entry) => entry.async('uint8array').then((u8) => [entry.name, u8]));
      const promiseOfList = Promise.all(listOfPromises);
      const md = markdownit({
        html: true,
        linkify: true,
        typographer: true,
      });
      promiseOfList.then((list) => {
        list.reduce((accumulator, current) => {
          const currentName = current[0];
          const currentValue = current[1];
          const nameParts = currentName.split('/');
          const manualId = nameParts[1];
          if (nameParts[2].endsWith('toc.yaml')) {
            articleMap[manualId].toc = yaml.parse(new TextDecoder().decode(currentValue));
            return;
          }
          if (nameParts[2].endsWith('config.yaml')) {
            articleMap[manualId].config = yaml.parse(new TextDecoder().decode(currentValue));
            return;
          }
          const articleId = nameParts[2];
          if (!(articleId in articleMap[manualId].articles)) {
            articleMap[manualId].articles[articleId] = {
              id: articleId,
            };
          }
          let body = '';
          switch (nameParts[3]) {
            case 'title.md':
              articleMap[manualId].articles[articleId].title = new TextDecoder().decode(currentValue).trim();
              return;
            case 'sub-title.md':
              articleMap[manualId].articles[articleId].subtitle = new TextDecoder().decode(currentValue).trim();
              return;
            case '01.md':
            default:
              body = md.render(new TextDecoder().decode(currentValue));
              if (useRcLinks) {
                body = body.replace(/href="\.\.\/([^/".]+)\/*(01.md){0,1}"/g, `href="rc://*/ta/man/${manualId}/$1"`);
                body = body.replace(/href="\.\.\/\.\.\/([^/".]+)\/([^/".]+)\/*(01.md){0,1}"/g, `href="rc://*/ta/man/$1/$2"`);
              } else {
                body = body.replace(/href="\.\.\/([^/".]+)\/*(01.md){0,1}"/g, `href="#${manualId}--$1"`);
                body = body.replace(/href="\.\.\/\.\.\/([^/".]+)\/([^/".]+)\/*(01.md){0,1}"/g, `href="#$1--$2"`);
              }
              body = body.replace(/(?<![">])(https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*))/g, '<a href="$1">$1</a>');
              body = body.replace(/(href="http[^"]+")/g, '$1 target="_blank"');
              articleMap[manualId].articles[articleId].body = body;
          }
        }, {});
        setTaFileContents(articleMap);
      });
    };

    if (catalogEntry && zipFileData) {
      getFileContents();
    }
  }, [catalogEntry, zipFileData, setErrorMessage]);

  return taFileContents;
}
