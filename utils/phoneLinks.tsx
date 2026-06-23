const phoneRegex = /(\+\d[\d\s\-\.()]{5,17}\d|\b0\d{7,9}\b)/g;

export function linkifyPhoneNumbers(text: string) {
  return text.split(phoneRegex).map((part, i) =>
    i % 2 === 1 ? (
      <a
        key={i}
        href={`tel:${part.replace(/[\s\-\.()]/g, "")}`}
        className="text-blue-500 underline"
      >
        {part}
      </a>
    ) : (
      part
    )
  );
}
