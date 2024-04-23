import utf8 from 'utf8';

export const decode = (encoded) => {
  const bytes = atob(encoded);
  const text = utf8.decode(bytes);
  return text;
};
