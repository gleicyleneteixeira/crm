import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
    static targets = ["blocksContainer", "blockTemplate"]

    connect() {
        if (this.blocksContainerTarget.children.length === 0) {
            this.addBlock()
        }
    }

    addBlock(event) {
        if (event) event.preventDefault()

        const index = this.blocksContainerTarget.children.length
        const template = this.blockTemplateTarget.innerHTML.replace(/INDEX/g, index)

        const div = document.createElement("div")
        div.innerHTML = template
        this.blocksContainerTarget.appendChild(div.firstElementChild)
    }

    removeBlock(event) {
        event.preventDefault()
        const block = event.target.closest(".message-block")
        block.remove()
        this.reindexBlocks()
    }

    reindexBlocks() {
        this.blocksContainerTarget.querySelectorAll(".message-block").forEach((block, index) => {
            block.querySelectorAll("input, textarea, select").forEach(input => {
                const name = input.getAttribute("name")
                if (name) {
                    input.setAttribute("name", name.replace(/\[\d+\]/, `[${index}]`))
                }
            })
        })
    }
}
