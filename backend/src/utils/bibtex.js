function safe(val) {
  return (val || "").replace(/[{}]/g, "");
}

function toBibTeX(paper) {
  const key = (paper.authors || "anon").split(",")[0].replace(/\s+/g, "_") + (paper.year || "");
  const fields = [];
  if (paper.title) fields.push(`  title={${safe(paper.title)}}`);
  if (paper.authors) fields.push(`  author={${safe(paper.authors)}}`);
  if (paper.year) fields.push(`  year={${safe(paper.year)}}`);
  if (paper.publication) fields.push(`  journal={${safe(paper.publication)}}`);
  if (paper.url) fields.push(`  url={${safe(paper.url)}}`);
  if (paper.doi) fields.push(`  doi={${safe(paper.doi)}}`);
  return `@article{${key},\n${fields.join(",\n")}\n}`;
}

module.exports = { toBibTeX };

