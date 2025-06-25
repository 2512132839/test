import admin from './admin.js';
import common from './common.js';
import markdown from './markdown.js';
import mount from './mount.js';
import upload from './upload.js';

export default {
  ...admin,
  ...common,
  ...markdown,
  ...mount,
  ...upload,
};