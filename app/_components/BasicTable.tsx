import React from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Pagination,
  getKeyValue,
} from "@nextui-org/react";
import { ActionButtonDef } from "@/app/_components/ActionButton";
import ActionButton from "./ActionButton";
import { formatDate } from "@/app/burn/[slug]/membership/components/helpers/date";

interface Column {
  key: string;
  label: string;
  render?: (value: any, item: any, additionalData: any) => React.ReactNode;
}

interface BasicTableProps<T> {
  data: T[];
  additionalData?: any;
  columns: Column[];
  rowsPerPage?: number;
  ariaLabel?: string;
  keyField?: keyof T;
  rowActions?: ActionButtonDef<T>[];
  noPagination?: boolean;
}

export default function BasicTable<T extends Record<string, any>>({
  data,
  additionalData,
  columns,
  rowsPerPage = 4,
  ariaLabel = "Table with pagination",
  keyField = "id",
  rowActions,
  noPagination = false,
}: BasicTableProps<T>) {
  const [page, setPage] = React.useState(1);
  const pages = Math.ceil(data.length / rowsPerPage);

  const items = React.useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;

    return data.slice(start, end);
  }, [page, data, rowsPerPage]);

  const getCellContent = (item: T, columnKey: string) => {
    const column = columns.find((col) => col.key === columnKey);
    const value = getKeyValue(item, columnKey);

    if (column?.render) {
      return column.render(value, item, additionalData);
    }

    // Default date formatting if the value is a date string
    if (typeof value === "string" && value.match(/^\d{4}-\d{2}-\d{2}/)) {
      return formatDate(value);
    }

    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }

    return value;
  };

  const columnsFull =
    rowActions?.length! > 0
      ? [...columns, { key: "actions", label: "Actions" }]
      : columns;

  return (
    <Table
      aria-label={ariaLabel}
      removeWrapper
      bottomContent={
        noPagination ? null : (
          <div className="flex w-full justify-center">
            <Pagination
              isCompact
              showControls
              showShadow
              page={page}
              total={pages}
              onChange={(page) => setPage(page)}
            />
          </div>
        )
      }
    >
      <TableHeader>
        {columnsFull.map((column) => (
          <TableColumn key={column.key}>{column.label}</TableColumn>
        ))}
      </TableHeader>
      <TableBody items={items}>
        {(item) => (
          <TableRow key={item[keyField]}>
            {(columnKey) => {
              if (columnKey === "actions" && rowActions?.length! > 0) {
                return (
                  <TableCell key={columnKey}>
                    <div className="flex gap-2">
                      {rowActions!.map((action) => (
                        <ActionButton
                          key={action.key}
                          action={action}
                          data={item}
                          size="sm"
                        />
                      ))}
                    </div>
                  </TableCell>
                );
              }
              return (
                <TableCell key={columnKey}>
                  {getCellContent(item, columnKey as any)}
                </TableCell>
              );
            }}
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
