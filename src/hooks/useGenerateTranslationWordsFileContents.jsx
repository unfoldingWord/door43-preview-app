import { useState, useEffect, useContext } from 'react';
import markdownit from 'markdown-it';
import { AppContext } from '@components/App.context';

export default function useGenerateTranslationWordsFileContents({ catalogEntry, zipFileData }) {
  const [twFileContents, setTwFileContents] = useState();
  const {
    actions: { setErrorMessage }
  } = useContext(AppContext);

  useEffect(() => {
    const getFileContents = async () => {
      const articleMap = {};
      let ingredient = null;
      let biblePath = '';
      catalogEntry.ingredients.forEach((i) => {
        if (i.identifier == 'bible') {
          ingredient = i;
          biblePath = `${catalogEntry.repo.name.toLowerCase()}/${i.path.replace(/^\.\//, '')}`;
        }
      });
      if (!biblePath || !(biblePath + '/' in zipFileData.files)) {
        setErrorMessage(`Path given in manifest file does not exist: ${ingredient.path}`);
        return;
      }
      const categories = {
        kt: {
          title: 'Key Terms',
          sort: 0,
        },
        names: {
          title: 'Names',
          sort: 1,
        },
        other: {
          title: 'Other',
          sort: 2,
        },
      };
      for (let categoryId in categories) {
        let category = categories[categoryId];
        const categoryPath = `${biblePath}/${categoryId}`;
        if (!(categoryPath + '/' in zipFileData.files)) {
          continue;
        }
        articleMap[categoryId] = {
          id: categoryId,
          sort: category.sort,
          title: category.title,
          articles: {},
        };
      }
      const listOfPromises = Object.keys(zipFileData.files)
        .filter((name) => name.split('/').slice(2, 3)?.[0] in categories && name.endsWith('.md'))
        .map((name) => zipFileData.files[name].async('uint8array').then((u8) => [name, u8]));
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
          const categoryId = nameParts[2];
          const articleId = nameParts[3].split('.')[0];
          if (!(articleId in articleMap[categoryId].articles)) {
            articleMap[categoryId].articles[articleId] = {
              id: articleId,
            };
          }
          let body = md.render(new TextDecoder().decode(currentValue));
          body = body.replace(/href="\.\/([^/".]+).md"/g, `href="#${categoryId}--$1"`);
          body = body.replace(/href="\.\.\/([^/".]+)\/*([^/]+).md"/g, `href="#$1--$2"`);
          body = body.replace(/(?<![">])(https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*))/g, '<a href="$1">$1</a>');
          body = body.replace(/(href="http[^"]+")/g, '$1 target="_blank"');

          let title = '';
          const headerMatch = body.match(/^\s*<(h\d)>(.*?)<\/\1>\s*\n(.*)/ms);
          if (headerMatch) {
            title = headerMatch[2];
            body = headerMatch[3];
          }

          articleMap[categoryId].articles[articleId].title = title;
          articleMap[categoryId].articles[articleId].body = body;
        }, {});
        setTwFileContents(articleMap);
      });
    };

    if (catalogEntry && zipFileData) {
      getFileContents();
    }
  }, [catalogEntry, zipFileData, setErrorMessage]);

  return twFileContents;
}
