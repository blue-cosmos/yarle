import uniqueFilename from 'unique-filename';
import sanitize from 'sanitize-filename';
import * as fs from 'fs';
import Moment from 'moment';
import * as path from 'path';
import * as mime from 'mime-types';
import { nanoid } from 'nanoid';

import { yarleOptions } from '../yarle';

import { ResourceFileProperties } from './../models/ResourceFileProperties';
import { OutputFormat } from './../output-format';
import { getCreationTime } from './content-utils';
import { escapeStringRegexp } from './escape-string-regexp';
import { isLogseqJournal } from './is-logseq-journal';
import { closest } from 'fastest-levenshtein';

const applyCharacterMapSafely = (title: string): string => {
  return applyCharacterMap(title).replace(/[/\\?%*:|"<>\[\]\+]/g, '-');
}
const applyCharacterMap = (title: string): string => {
  let appliedTitle = title;
  try{
    for (const key of Object.keys(yarleOptions.replacementCharacterMap)){
      const replacement = yarleOptions.replacementCharacterMap[key as any];

      const regex: RegExp = new RegExp(escapeStringRegexp(key), 'g');
      appliedTitle = appliedTitle.replace(regex, replacement)
    }
  }catch(e){
    console.log(e)
  }
  console.log(appliedTitle)
  return appliedTitle;
}

export const normalizeTitle = (title: string) => {
  // Allow setting a specific replacement character for file and resource names
  // Default to a retrocompatible value
  const normalizedTitle = sanitize(applyCharacterMap(title), {replacement: yarleOptions.replacementChar || '_'}).replace(/[\[\]\#\^]/g, '')
  console.log(normalizedTitle)
  return normalizedTitle;
  ;
};

export const getFileIndex = (dstPath: string, fileNamePrefix: string): number | string => {
  const index = fs
    .readdirSync(dstPath)
    .filter(file => {
      // make sure we get the first copy with no count suffix or the copies whose filename changed
      // drop the extension to compare with filename prefix
      const filePrefix = file.split('.').slice(0, -1).join('.');
      return filePrefix.toLowerCase().startsWith(fileNamePrefix.toLowerCase());
    })
    .length;

  return index;

};
export const getResourceFileProperties = (workDir: string, resource: any): ResourceFileProperties => {
  const UNKNOWNFILENAME = yarleOptions.useUniqueUnknownFileNames ? uniqueFilename('', 'unknown_filename') : 'unknown_filename';

  let extension = getExtension(resource);
  let fileName = UNKNOWNFILENAME;

  if (resource['resource-attributes'] && resource['resource-attributes']['file-name']) {
    const fileNamePrefix = resource['resource-attributes']['file-name'].substr(0, 50);
    fileName = fileNamePrefix.split('.')[0];
  }
  fileName = applyCharacterMapSafely(fileName);
  extension = applyCharacterMapSafely(extension);
  if (yarleOptions.sanitizeResourceNameSpaces) {
    fileName = fileName.replace(/ /g, yarleOptions.replacementChar);
  }
  if (yarleOptions.urlEncodeFileNamesAndLinks && yarleOptions.outputFormat === OutputFormat.ObsidianMD) {
    fileName = encodeURI(fileName);
  }
  const index = getFileIndex(workDir, fileName);
  const fileNameWithIndex = index > 0 ? `${fileName}.${index}` : fileName;

  return {
    fileName: `${fileNameWithIndex}.${extension}`,
    extension,
    index,
  };
};

export const getFilePrefix = (note: any): string => {
  return normalizeTitle(note['title'] ? `${note['title'].toString()}` : 'Untitled');
};

export const getNoteFileName = (dstPath: string, note: any, extension: string = 'md'): string => {
  return `${getNoteName(dstPath, note)}.${extension}`;
};
export const getExtensionFromResourceFileName = (resource: any): string => {
  if (!(resource['resource-attributes'] &&
      resource['resource-attributes']['file-name'])) {
      return undefined;
  }
  const splitFileName = resource['resource-attributes']['file-name'].split('.');

  return splitFileName.length > 1 ? splitFileName[splitFileName.length - 1] : undefined;

};
export const getExtensionFromMime = (resource: any): string => {
  const mimeType = resource.mime;
  if (!mimeType) {
    return undefined;
  }

  return mime.extension(mimeType);
};

export const getExtension = (resource: any): string => {
  const UNKNOWNEXTENSION = 'dat';

  return getExtensionFromResourceFileName(resource) || getExtensionFromMime(resource) || UNKNOWNEXTENSION;
};

export const getZettelKastelId = (note: any, dstPath: string): string => {
  return Moment(note['created']).format('YYYYMMDDHHmm');

};

export const getUniqueId = (): string => {
  return nanoid(5);
};

export const getNoteName = (dstPath: string, note: any): string => {
  let noteName;

  if (yarleOptions.isZettelkastenNeeded || yarleOptions.useZettelIdAsFilename) {
    const zettelPrefix = getZettelKastelId(note, dstPath);
    const nextIndex = getFileIndex(dstPath, zettelPrefix);
    const separator = ' ';
    noteName = (nextIndex !== 0) ?
      `${zettelPrefix}.${nextIndex}` :
      zettelPrefix;

    if (!yarleOptions.useZettelIdAsFilename) {
      noteName += getFilePrefix(note) !== 'Untitled' ? `${separator}${getFilePrefix(note)}` : '';
    }
  } else {
    const fileNamePrefix = getFilePrefix(note);
    const nextIndex = getFileIndex(dstPath, fileNamePrefix);

    noteName = (nextIndex === 0) ? fileNamePrefix :  `${fileNamePrefix}.${nextIndex}`;
  }
  if (isLogseqJournal(yarleOptions)) {
    return getCreationTime(note);
  }

  return noteName;

};

export const getNotebookName = (enexFile: string): string => {
  const notebookName = path.basename(enexFile, '.enex');

  return notebookName;
};


export const getClosestFileName = (text: string ,allconvertedFiles: string[]): string => {
  return closest(text, allconvertedFiles);
}