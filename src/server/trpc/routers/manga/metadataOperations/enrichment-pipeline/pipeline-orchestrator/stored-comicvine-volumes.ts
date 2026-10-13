/**
 * `providerMetadata.comicvine.volumeData` is not ComicVine's answer: finalize
 * mirrors every Volume row into it, whatever wrote the row. When ComicVine is
 * unreachable, the pipeline falls back to that mirror as if ComicVine had
 * answered, so a range the pipeline guessed (reconciliation's Tokyo Ghoul
 * "volume 15" 144-159, a NULL-source Dandadan "volume 25" 214-249) came back
 * on the next outage labelled `comicvine`.
 *
 * Only rows whose stored source names ComicVine are ComicVine's. Rows mirrored
 * before the source was recorded carry none and are not used.
 */
export function comicVineAttestedVolumes(
  stored: ReadonlyArray<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return stored.filter((v) => {
    const source = v['source'];
    const attested = typeof source === 'string' && source.split('+').includes('comicvine');
    return attested && v['chapterStart'] !== undefined && v['chapterEnd'] !== undefined;
  });
}
