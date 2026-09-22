package xlsxstream

import (
	"bytes"
	"testing"

	"github.com/xuri/excelize/v2"
)

func TestWriteStreamsHeadersAndRows(t *testing.T) {
	var output bytes.Buffer
	err := Write(&output, Options{Sheet: "Export", Headers: []any{"id", "name"}}, func(_ *excelize.File, yield func(Row) error) error {
		for _, row := range []Row{
			{Values: []any{int64(42), "first"}},
			{Values: []any{int64(43), "second"}},
		} {
			if err := yield(row); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		t.Fatalf("Write() error = %v", err)
	}
	workbook, err := excelize.OpenReader(bytes.NewReader(output.Bytes()))
	if err != nil {
		t.Fatalf("OpenReader() error = %v", err)
	}
	defer workbook.Close()
	rows, err := workbook.GetRows("Export")
	if err != nil {
		t.Fatalf("GetRows() error = %v", err)
	}
	if len(rows) != 3 || len(rows[0]) != 2 || rows[0][0] != "id" || rows[1][0] != "42" || rows[1][1] != "first" || rows[2][0] != "43" || rows[2][1] != "second" {
		t.Fatalf("rows = %#v", rows)
	}
}
