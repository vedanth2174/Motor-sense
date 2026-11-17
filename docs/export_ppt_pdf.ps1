param(
    [string]$PptxPath = "D:\project\BACKUP PROJECT\docs\MotorSense_Presentation.pptx",
    [string]$PdfPath = "D:\project\BACKUP PROJECT\docs\MotorSense_Presentation.pdf"
)

Write-Host "Exporting PPTX to PDF..."
$ppt = $null
$pres = $null
try {
    $ppt = New-Object -ComObject PowerPoint.Application
    $pres = $ppt.Presentations.Open($PptxPath, [Microsoft.Office.Core.MsoTriState]::msoTrue, [Microsoft.Office.Core.MsoTriState]::msoFalse, [Microsoft.Office.Core.MsoTriState]::msoFalse)
    
    # 32 = ppSaveAsPDF
    $pres.SaveAs($PdfPath, 32)
    $pres.Close()
    $ppt.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
    Write-Host "SUCCESS: Exported to $PdfPath"
}
catch {
    Write-Host "ERROR: $_"
    if ($pres) { $pres.Close() }
    if ($ppt) { $ppt.Quit() }
}
