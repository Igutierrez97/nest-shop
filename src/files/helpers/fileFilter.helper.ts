export const fileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  // eslint-disable-next-line @typescript-eslint/ban-types
  cb: Function,
) => {
  if (!file) return cb(new Error('File is Empty'), false);

  const fileExtension = file.mimetype.split('/')[1];
  const validExtension = ['jpg', 'png', 'jpeg'];

  if (validExtension.includes(fileExtension)) {
    return cb(null, true);
  }
  cb(null, false);
};
