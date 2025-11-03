
'use client'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export default function ReportPDFButton({selector='#report', filename='tasacion.pdf'}:{selector?:string, filename?:string}){
  const onExport = async () => {
    const el = document.querySelector(selector) as HTMLElement | null
    if(!el) return alert('No hay contenido para exportar')
    const canvas = await html2canvas(el, { scale: 2 })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({orientation:'p', unit:'pt', format:'a4'})
    const pageWidth = pdf.internal.pageSize.getWidth()
    const ratio = pageWidth / canvas.width
    pdf.addImage(imgData, 'PNG', 0, 20, pageWidth, canvas.height*ratio)
    pdf.save(filename)
  }
  return <button onClick={onExport} className="btn btn-secondary">Exportar PDF</button>
}
