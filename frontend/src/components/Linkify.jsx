/**
 * Renders text with URLs turned into clickable links (opens in new tab).
 * Use for task content, comments, or any user text that may contain links.
 */
export function Linkify({ text }) {
  if (text == null || text === '') return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return (
    <>
      {parts.map((part, i) =>
        part.match(urlRegex) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-600 hover:text-brand-700 underline break-all"
          >
            {part}
          </a>
        ) : (
          part
        )
      )}
    </>
  );
}
