import { useState, useEffect } from 'react';
import useGenerateTranslationAcademyFileContents from './useGenerateTranslationAcademyFileContents';

export default function useGenerateTranslationAcademyManuals({ catalogEntry, zipFileData, setErrorMessage }) {
  const [taManuals, setTaManuals] = useState();

  const taFileContents = useGenerateTranslationAcademyFileContents({
    catalogEntry,
    zipFileData,
    setErrorMessage,
  });

  const addPropertiesToTocSections = (manual, sections) => {
    if (!sections || !sections.length) {
      return sections;
    }
    for (let i = 0; i < sections.length; i++) {
      sections[i].id = sections[i].link;
      sections[i].manual_id = manual.id;
      sections[i].toctitle = sections[i].title;
      if (!sections[i].link && sections[i].title) {
        sections[i].link = 'section-' + sections[i].title.replace(/\W+/g, '-').toLowerCase();
        sections[i].body = '';
      } else {
        if (sections[i].link in taFileContents[manual.id].articles) {
          sections[i].title = taFileContents[manual.id].articles[sections[i].link].title;
          sections[i].body = taFileContents[manual.id].articles[sections[i].link].body;
        }
      }
      sections[i].link = `${manual.id}--${sections[i].link}`;
      sections[i].sections = addPropertiesToTocSections(manual, sections[i].sections);
    }
    return sections;
  };

  useEffect(() => {
    const getAllManualSections = async () => {
      const allManualSections = [];
      Object.values(taFileContents)
        .sort((a, b) => (a.sort > b.sort ? 1 : b.title > a.title ? -1 : 0))
        .forEach((manual) => {
          const manualTopSection = {
            id: manual.id,
            manual_id: manual.id,
            link: `${manual.id}--${manual.id}`,
            sections: [],
            title: manual.title,
          };
          if (manual.toc && Object.keys(manual.toc).length) {
            manualTopSection.sections = addPropertiesToTocSections(manualTopSection, manual.toc.sections);
          } else {
            Object.values(manual.articles)
              .sort((a, b) => (a.title > b.title ? 1 : b.title > a.title ? -1 : 0))
              .forEach((article) => {
                manualTopSection.sections.push({
                  id: article.id,
                  manual_id: manualTopSection.id,
                  link: `${manual.id}--${article.id}`,
                  title: article.title,
                  toctitle: article.title,
                  body: article.body,
                });
              });
          }
          allManualSections.push(manualTopSection);
        });
      setTaManuals(allManualSections);
    };

    if (taFileContents) {
      getAllManualSections();
    }
  }, [taFileContents, setTaManuals]);

  return taManuals;
}
