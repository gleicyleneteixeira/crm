import { DirectUpload } from "@rails/activestorage";
import WaveSurfer from "wavesurfer.js";
import Hover from "wavesurfer.js/dist/plugins/hover.js";

export default class UploadFile {
  constructor(file, fileInput, pauseSvg, playSvg, acceptedTypes) {
    this.directUpload = new DirectUpload(
      file,
      "/rails/active_storage/direct_uploads",
      this
    );
    this.fileInput = fileInput;
    this.pauseSvg = pauseSvg;
    this.playSvg = playSvg;
    this.acceptedTypes = acceptedTypes;
  }

  process() {
    const fileWrapper = this.insertUpload();
    if (!fileWrapper) return;
    const progressBar = fileWrapper.querySelector("#progressWrapper");
    if (!progressBar) return;
    if (!this.acceptedTypes.includes(this.getFileType())) {
      progressBar.remove();
      this.showErrorMessage("this file type is not allowed", fileWrapper);
    } else if (this.isFileSizeExceeded()) {
      progressBar.remove();
      this.showErrorMessage(
        "The file exceeds the allowed size limit (40MB).",
        fileWrapper
      );
    } else {
      this.directUpload.create((error, blob) => {
        progressBar.remove();
        if (error) {
          this.showErrorMessage(error, fileWrapper);
        } else {
          if (this.fileTypeIs("audio")) {
            this.createWaveForm(fileWrapper);
          }
          this.createHiddenBlobInput(blob, this.directUpload.id);
        }
      });
    }
  }
  createWaveForm(fileWrapper) {
    const uploadInfo = fileWrapper.querySelector(
      `#upload_${this.directUpload.id}_info`
    );
    const waveWrapper = document.createElement("div");
    const wave = document.createElement("div");
    const audioDuration = document.createElement("p");
    waveWrapper.className = "flex items-center gap-2.5 justify-end";
    audioDuration.className =
      "typography-body-m-lh150 text-dark-gray-palette-p2";
    waveWrapper.appendChild(wave);
    waveWrapper.appendChild(audioDuration);
    uploadInfo.appendChild(waveWrapper);

    const reader = new FileReader();
    reader.readAsDataURL(this.directUpload.file);
    reader.onloadend = () => {
      const audioUrl = reader.result;
      const waveForm = WaveSurfer.create({
        container: wave,
        waveColor: "#D9DEFF",
        progressColor: "#6756D6",
        url: audioUrl,
        height: 42,
        barGap: 4,
        barRadius: 30,
        barWidth: 2,
        width: 412,
        cursorWidth: 0,
        plugins: [Hover.create()],
      });
      waveForm.on("finish", () => {
        playPauseBtn.querySelector("img").setAttribute("src", this.playSvg);
      });
      waveForm.on("ready", () => {
        audioDuration.textContent = this.formatTime(waveForm.getDuration());
      });
      const playPauseBtn = fileWrapper.querySelector("#playPauseBtn");
      playPauseBtn.classList.remove("pointer-events-none");
      playPauseBtn.onclick = (event) => {
        event.preventDefault();
        waveForm.playPause();
        this.togglePlayIcon(playPauseBtn.querySelector("img"));
      };
    };
  }
  formatTime(time) {
    return [
      Math.floor((time % 3600) / 60), // minutes
      ("00" + Math.floor(time % 60)).slice(-2), // seconds
    ].join(":");
  }
  togglePlayIcon(img) {
    const newIconSrc = img.getAttribute("src").includes(this.playSvg)
      ? this.pauseSvg
      : this.playSvg;
    img.setAttribute("src", newIconSrc);
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
      `#upload_${this.directUpload.id}_info #progressWrapper #progressBar`
    );
    if (progress) progress.style.width = `${percentage}%`;
  }
  createHiddenBlobInput(blob, uploadId) {
    const input = document.createElement("input");
    const inputWrapper = document.getElementById(`upload_${uploadId}`);
    if (!inputWrapper) return;
    input.type = "hidden";
    input.name = this.fileInput.name;
    input.value = blob.signed_id;
    inputWrapper.appendChild(input);
  }
  createAudioWrapper() {
    const audioWrapper = document.querySelector("#audioWrapper");
    if (!audioWrapper) return null;
    const fileWrapper = audioWrapper.cloneNode(true);
    const uploadInfo = fileWrapper.querySelector("#uploadInfo");
    const fileName = fileWrapper.querySelector("#fileName");
    fileWrapper.classList.remove("hidden");
    fileWrapper.id = `upload_${this.directUpload.id}`;
    if (uploadInfo) uploadInfo.id = `upload_${this.directUpload.id}_info`;
    if (fileName) fileName.textContent = this.directUpload.file.name;
    this.addFileToUploadList(fileWrapper);
    return fileWrapper;
  }
  insertUpload() {
    let fileWrapper;
    if (this.fileTypeIs("audio")) {
      fileWrapper = this.createAudioWrapper();
    } else {
      fileWrapper = this.createFileWrapper();
    }
    return fileWrapper;
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
    this.setLinkFileThumb(fileWrapper);
    this.addFileToUploadList(fileWrapper);
    return fileWrapper;
  }
  addFileToUploadList(file) {
    const uploadList = document.querySelector("#uploads");
    if (uploadList) uploadList.appendChild(file);
  }
  setLinkFileThumb(fileWrapper) {
    let reader = new FileReader();
    const fileInfoWrapper = fileWrapper.querySelector("#fileInfoWrapper");
    const fileThumb = fileWrapper.querySelector("#fileThumb");
    const linkThumb = fileWrapper.querySelector("#linkThumb");

    reader.readAsDataURL(this.directUpload.file);
    reader.onloadend = () => {
      if (reader.result !== null && this.fileTypeIs("image")) {
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
