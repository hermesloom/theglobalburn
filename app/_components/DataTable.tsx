"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { Button, Input } from "@nextui-org/react";
import { apiGet } from "@/app/_components/api";
import BasicTable from "@/app/_components/BasicTable";
import Heading from "@/app/_components/Heading";
import ActionButton, { ActionButtonDef } from "./ActionButton";
import Dropdown from "@/app/_components/Dropdown";
import { DeleteOutlined, EyeOutlined } from "@ant-design/icons";
import { apiDelete } from "@/app/_components/api";
import { usePrompt } from "@/app/_components/PromptContext";
import toast from "react-hot-toast";

export type DataItem = {
  id: string;
  [key: string]: any;
};

export type FullData = {
  data: DataItem[];
  [key: string]: any;
};

export type TableSearchField = {
  id: string;
  label: string;
  getValue: (row: DataItem) => string;
};

export type TableSearchBarConfig = {
  placeholder?: string;
  fields: TableSearchField[];
};

interface DataTableProps {
  endpoint: string;
  columns: Array<{
    key: string;
    label: string;
    render?: (value: any, item: any, additionalData: any) => React.ReactNode;
  }>;
  title: string;
  globalActions?: ActionButtonDef<FullData>[];
  rowActions?: ActionButtonDef<DataItem>[];
  rowActionsCrud?: {
    viewMetadata?: boolean;
    delete?: boolean;
    /** Shown via react-hot-toast after a successful row delete. */
    deleteSuccessMessage?: string;
  };
  /** Applied client-side after load (e.g. sort by email). */
  sortRows?: (a: DataItem, b: DataItem) => number;
  /** Dropdown + input in the toolbar row; rows are filtered client-side. */
  searchBar?: TableSearchBarConfig;
}

export default function DataTable({
  endpoint,
  columns,
  title,
  globalActions,
  rowActions,
  rowActionsCrud,
  sortRows,
  searchBar,
}: DataTableProps) {
  const initialLoadDone = useRef(false);
  const [fullData, setFullData] = useState<FullData | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFieldId, setSearchFieldId] = useState<string | null>(null);
  const prompt = usePrompt();

  const activeSearchFieldId =
    searchFieldId && searchBar?.fields.some((f) => f.id === searchFieldId)
      ? searchFieldId
      : (searchBar?.fields[0]?.id ?? "");

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await apiGet(endpoint);
      setFullData(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      loadData();
    }
  }, [endpoint]);

  const rowActionsFull: ActionButtonDef<DataItem>[] = [...(rowActions ?? [])];
  if (rowActionsCrud?.viewMetadata) {
    rowActionsFull.push({
      key: "view-data",
      icon: <EyeOutlined />,
      tooltip: "View data",
      onClick: async (row) => {
        const label =
          row?.profiles?.email ?? row?.email ?? row?.id ?? "this row";
        await prompt(
          <div className="flex flex-col gap-2">
            <span>Data for {label}</span>
            <pre className="text-sm font-normal overflow-auto max-h-[min(70vh,32rem)]">
              {JSON.stringify(row, null, 2)}
            </pre>
          </div>,
          undefined,
          "Close"
        );
      },
    });
  }
  if (rowActionsCrud?.delete) {
    const deleteToast = rowActionsCrud.deleteSuccessMessage;
    rowActionsFull.push({
      key: "delete",
      tooltip: "Delete",
      icon: <DeleteOutlined />,
      onClick: async (data) => {
        await apiDelete(endpoint + "/" + data!.id);
        if (deleteToast) {
          toast.success(deleteToast);
        }
        return true;
      },
      successCallback: loadData,
    });
  }

  const tableRows = useMemo(() => {
    if (!fullData?.data) {
      return [];
    }
    let rows = [...fullData.data];
    const q = searchQuery.trim().toLowerCase();
    if (searchBar?.fields.length && q) {
      const field =
        searchBar.fields.find((f) => f.id === activeSearchFieldId) ??
        searchBar.fields[0];
      rows = rows.filter((row) =>
        String(field.getValue(row) ?? "")
          .toLowerCase()
          .includes(q),
      );
    }
    if (sortRows) {
      rows.sort(sortRows);
    }
    return rows;
  }, [fullData, searchBar, activeSearchFieldId, searchQuery, sortRows]);

  return (
    <div>
      <Heading>{title}</Heading>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4 mb-3">
        <div className="flex flex-wrap items-end gap-2">
          <Button
            color="primary"
            aria-label={`Reload ${endpoint}`}
            onPress={loadData}
            isLoading={loading}
          >
            {!loading && "Reload"}
          </Button>
          {globalActions && !loading ? (
            <>
              {globalActions.map((action) => (
                <ActionButton
                  key={action.key}
                  action={{ ...action, successCallback: loadData }}
                  data={fullData!}
                />
              ))}
            </>
          ) : null}
        </div>
        {fullData && !loading && searchBar && searchBar.fields.length > 0 ? (
          <div className="grid min-w-0 max-w-full grid-cols-1 items-end gap-2 sm:grid-cols-[auto_minmax(0,1fr)]">
            <div className="w-full justify-self-start sm:w-auto">
              <Dropdown
                buttonPrefix="Filter by: "
                options={searchBar.fields.map((f) => ({
                  id: f.id,
                  label: f.label,
                }))}
                value={activeSearchFieldId}
                onChange={(id) => setSearchFieldId(id)}
              />
            </div>
            <div className="min-w-0 w-full">
              <Input
                className="w-full"
                placeholder={searchBar.placeholder ?? "Type to filter…"}
                value={searchQuery}
                onValueChange={setSearchQuery}
                aria-label="Filter table"
              />
            </div>
          </div>
        ) : null}
      </div>
      {fullData && !loading ? (
        <BasicTable
          data={tableRows}
          additionalData={fullData}
          columns={columns}
          rowsPerPage={10}
          ariaLabel={`${title} table`}
          rowActions={rowActionsFull}
        />
      ) : null}
    </div>
  );
}
