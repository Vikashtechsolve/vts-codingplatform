/** Persist share-link attempt across login redirect (location.state is lost). */
const SHARE_LINK_KEY = 'examFromShareLink';

export const isFromShareLink = (location) =>
  Boolean(location?.state?.fromShareLink) || sessionStorage.getItem(SHARE_LINK_KEY) === '1';

export const markShareLinkAttempt = () => {
  sessionStorage.setItem(SHARE_LINK_KEY, '1');
};

export const clearShareLinkAttempt = () => {
  sessionStorage.removeItem(SHARE_LINK_KEY);
};
