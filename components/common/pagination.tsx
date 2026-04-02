type PaginationProps = {
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

export const Pagination = ({ page, total, pageSize, onPageChange }: PaginationProps) => {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="pagination-wrap">
      <button className="outline-btn" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        <i className="bi bi-chevron-left" /> Prev
      </button>
      <span className="small text-muted">
        Page {page} of {pageCount}
      </span>
      <button className="outline-btn" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
        Next <i className="bi bi-chevron-right" />
      </button>
    </div>
  );
};