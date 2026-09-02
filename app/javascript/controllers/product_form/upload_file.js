import { DirectUpload } from "@rails/activestorage";

export default class UploadFile {
  constructor(file, fileInput, acceptedTypes) {
    this.directUpload = new DirectUpload(
      file,
      "/rails/active_storage/direct_uploads",
      this
    );
    this.fileInput = fileInput;
    this.acceptedTypes = acceptedTypes;
  }

  process() {
    const fileWrapper = this.createFileWrapper();
    if (!this.acceptedTypes.includes(this.getFileType())) {
      this.showErrorMessage("this file type is not allowed", fileWrapper);
    } else if (this.isFileSizeExceeded()) {
      this.showErrorMessage(
        "The file exceeds the allowed size limit (40MB).",
        fileWrapper
      );
    } else {
      this.directUpload.create((error, blob) => {
        if (error) {
          this.showErrorMessage(error, fileWrapper);
        } else {
          this.createHiddenBlobInput(blob, this.directUpload.id);
        }
      });
    }
  }

  isFileSizeExceeded() {
    const fileSize = this.directUpload.file.size;
    const fileSizeLimit = 41943040;
    return fileSize > fileSizeLimit;
  }
  directUploadWillStoreFileWithXHR(request) {
    request.upload.addEventListener("progress", (event) =>
      this.updateProgress(event)
    );
  }
  updateProgress(event) {
    const percentage = (event.loaded / event.total) * 100;
    const progress = document.querySelector(
      `#upload_${this.directUpload.id} #progressBar`
    );
    if (progress) progress.style.width = `${percentage}%`;
  }
  createHiddenBlobInput(blob, uploadId) {
    const input = document.createElement("input");
    const inputWrapper = document.getElementById(`upload_${uploadId}`);
    if (!inputWrapper) return;
    input.type = "hidden";
    input.name = `product[attachments_attributes][${this.directUpload.id}][file]`;
    input.value = blob.signed_id;
    inputWrapper.appendChild(input);
  }
  createFileWrapper() {
    const fileWrapperTemplate = document.querySelector("#fileWrapper");
    if (!fileWrapperTemplate) return null;
    const fileWrapper = fileWrapperTemplate.cloneNode(true);
    const uploadInfo = fileWrapper.querySelector("#uploadInfo");
    const fileName = fileWrapper.querySelector("#fileName");
    fileWrapper.classList.remove("hidden");
    fileWrapper.id = `upload_${this.directUpload.id}`;
    if (uploadInfo) uploadInfo.id = `upload_${this.directUpload.id}_info`;
    if (fileName) fileName.textContent = this.directUpload.file.name;
    this.setThumbAttachment(fileWrapper);
    this.addFileToUploadList(fileWrapper);
    return fileWrapper;
  }
  addFileToUploadList(file) {
    const uploadList = document.querySelector("#uploads");
    if (uploadList) uploadList.appendChild(file);
  }
  setThumbAttachment(fileWrapper) {
    if (this.fileTypeIs("image")) {
      this.setLinkFileThumb(fileWrapper);
    } else if (this.fileTypeIs("video")) {
      const iconVideo = fileWrapper.querySelector("[data-lucide='video']");
      if (iconVideo) iconVideo.classList.remove("hidden");
    } else {
      const iconFile = fileWrapper.querySelector("[data-lucide='file']");
      if (iconFile) iconFile.classList.remove("hidden");
    }
  }
  setLinkFileThumb(fileWrapper) {
    let reader = new FileReader();
    const fileInfoWrapper = fileWrapper.querySelector("#fileInfoWrapper");
    const fileThumb = fileWrapper.querySelector("#fileThumb");
    const linkThumb = fileWrapper.querySelector("#linkThumb");
    if (fileThumb) fileThumb.classList.remove("hidden");
    reader.readAsDataURL(this.directUpload.file);
    reader.onloadend = () => {
      if (reader.result !== null) {
        if (fileInfoWrapper) fileInfoWrapper.setAttribute("data-controller", "lightbox");
        if (fileThumb) fileThumb.src = reader.result;
        if (linkThumb) {
          linkThumb.href = reader.result;
          linkThumb.classList.remove("pointer-events-none");
        }
      }
    };
  }
  fileTypeIs(type) {
    const fileType = this.getFileType();
    return fileType === type;
  }
  getFileType() {
    return this.directUpload.file.type.split("/")[0];
  }
  showErrorMessage(message, fileWrapper) {
    const uploadInfo = fileWrapper.querySelector(
      `#upload_${this.directUpload.id}_info`
    );
    fileWrapper.classList.replace(
      "border-light-palette-p3",
      "border-auxiliary-palette-red"
    );
    const messageError = `<p class='w-4/5 typography-text-m-lh150 text-auxiliary-palette-red truncate'>${message}</p>`;
    if (uploadInfo) uploadInfo.insertAdjacentHTML("beforeend", messageError);
  }
}
