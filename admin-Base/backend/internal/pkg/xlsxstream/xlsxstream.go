package xlsxstream

import (
	"fmt"
	"io"

	"github.com/xuri/excelize/v2"
)

type Options struct {
	Sheet       string
	Headers     []any
	Setup       func(*excelize.File, string) error
	StreamSetup func(*excelize.File, *excelize.StreamWriter) error
}

type Row struct {
	Values  []any
	Options []excelize.RowOpts
}

type Rows func(file *excelize.File, yield func(Row) error) error

func Write(dst io.Writer, options Options, rows Rows) error {
	file := excelize.NewFile()
	defer file.Close()
	if err := file.SetSheetName("Sheet1", options.Sheet); err != nil {
		return err
	}
	if options.Setup != nil {
		if err := options.Setup(file, options.Sheet); err != nil {
			return err
		}
	}
	stream, err := file.NewStreamWriter(options.Sheet)
	if err != nil {
		return err
	}
	if options.StreamSetup != nil {
		if err := options.StreamSetup(file, stream); err != nil {
			return err
		}
	}
	if err := stream.SetRow("A1", options.Headers); err != nil {
		return err
	}
	rowNumber := 2
	if err := rows(file, func(row Row) error {
		cell, err := excelize.CoordinatesToCellName(1, rowNumber)
		if err != nil {
			return err
		}
		if err := stream.SetRow(cell, row.Values, row.Options...); err != nil {
			return fmt.Errorf("write row %d: %w", rowNumber, err)
		}
		rowNumber++
		return nil
	}); err != nil {
		return err
	}
	if err := stream.Flush(); err != nil {
		return err
	}
	return file.Write(dst)
}
